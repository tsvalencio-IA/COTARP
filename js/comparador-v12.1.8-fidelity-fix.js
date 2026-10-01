/*
  COTARP V12.1.8 — fidelidade de lista, múltiplas fotos e alternativas por fornecedor.
  Correção cirúrgica sobre V12.1.5. Não remove rotinas existentes.
*/
(function applyCotarpV1218(attempt){
  'use strict';

  const C=window.Comparator;
  if(!C || !C.__v1215SupplierTextFixApplied){
    if((attempt||0)<80)setTimeout(function(){applyCotarpV1218((attempt||0)+1);},100);
    return;
  }
  if(C.__v1218FidelityFixApplied)return;
  C.__v1218FidelityFixApplied=true;
  window.COTARP_COMPARE_FIX_VERSION='12.1.8';

  const previousKnownBrands=C.knownBrands;
  const previousParseRequestedText=C.parseRequestedText;
  const previousNormalizeMatch=C.normalizeMatch;
  const previousConcept=C.concept;
  const previousMatchScore=C.matchScore;
  const previousSuggestRequestedId=C.suggestRequestedId;
  const previousParseOffersLocal=C.parseOffersLocal;
  const previousRenderSuppliers=C.renderSuppliers;

  C.knownBrands=function(){
    const current=previousKnownBrands.call(this);
    return Array.from(new Set(current.concat(['DYNA','VETOR','INDISA','IPECEL','MICRO','MOURA','WEGA','RANALLE','CAR FLOOR','REMOVEL','AUTOFLEX'])));
  };

  C.parseRequestedText=function(text){
    const entries=this.splitEntries(text);
    let start=0,vehicle='';
    if(entries.length && this.looksLikeVehicle(entries[0]) && !this.looksLikePart(entries[0])){
      const vehicleParts=[entries[0]];
      start=1;
      while(start<entries.length && !this.looksLikePart(entries[start]) && !this.beginsQuantity(entries[start])){
        vehicleParts.push(entries[start]);
        start++;
      }
      vehicle=vehicleParts.join(' - ');
    }
    let requested=[];
    entries.slice(start).forEach(function(line){
      let current=String(line||'').replace(/^[\-–—•*]+\s*/,'').trim();
      if(!current)return;
      const lead=C.leadingQuantityInfo(current);
      const qty=lead.shown&&lead.qty>0?lead.qty:1;
      if(lead.shown)current=current.slice(lead.end).trim();
      if(!current)return;
      requested.push({id:C.id('req'),order:requested.length,description:current,qty:qty,unit:'PC',explicitQty:lead.shown,note:''});
    });
    requested=this.contextualizeKits(requested).map(function(item,index){
      const clean=Object.assign({},item,{id:item.id||C.id('req'),order:index});
      delete clean.explicitQty;
      return clean;
    });
    return {vehicle:vehicle,requested:requested,duplicatesMerged:0};
  };

  C.normalizeMatch=function(value){
    let p=this.plain(value);
    p=p
      .replace(/\bDIR\b/g,' DIREITO ')
      .replace(/\bESQ\b/g,' ESQUERDO ')
      .replace(/\bLADO\s+DIREITO\b/g,' DIREITO ')
      .replace(/\bLADO\s+ESQUERDO\b/g,' ESQUERDO ')
      .replace(/\bVIGIA\b/g,' TRASEIRO ')
      .replace(/\bPARA\s*BRISA\b/g,' PARABRISA ')
      .replace(/\bROLAMENTO\s+TENSOR\b/g,' POLIA TENSORA ')
      .replace(/\bTENSIONADOR(?:A)?\b/g,' POLIA TENSORA ')
      .replace(/\bCORREIA\s+COMANDO\b/g,' CORREIA DENTADA ')
      .replace(/\bHASTE\s+(?:DA\s+)?BARRA\s+ESTABILIZADORA\b/g,' BIELETA ')
      .replace(/\bMAQUINA\s+(?:DO\s+)?VIDRO\b/g,' MAQUINA VIDRO ')
      .replace(/\bMOTOR\s+(?:DO\s+)?VIDRO\b/g,' MOTOR VIDRO ')
      .replace(/\bCAIXA\s+DE\s+MUDANCAS\b/g,' CAMBIO ')
      .replace(/\bFILTRO\s+(?:DO\s+)?A\s*C\b/g,' FILTRO AR CONDICIONADO ');
    return previousNormalizeMatch.call(this,p);
  };

  C.concept=function(value){
    const p=this.normalizeMatch(value);
    if(/COXIM/.test(p)&&/MOTOR/.test(p))return 'COXIM_MOTOR';
    if(/COXIM/.test(p)&&/(CAMBIO|CAIXA)/.test(p))return 'COXIM_CAMBIO';
    if(/(?:POLIA\s+TENSORA|ROLAMENTO\s+TENSOR)/.test(p)&&/CORREIA/.test(p))return 'TENSOR_CORREIA';
    if(/BOMBA/.test(p)&&/COMBUSTIVEL/.test(p))return 'BOMBA_COMBUSTIVEL';
    if(/BOMBA/.test(p)&&/AGUA/.test(p))return 'BOMBA_AGUA';
    if(/FECHADURA/.test(p)&&/CAPO/.test(p))return 'FECHADURA_CAPO';
    if(/MAQUINA\s+VIDRO/.test(p))return 'MAQUINA_VIDRO';
    if(/MOTOR\s+VIDRO/.test(p))return 'MOTOR_VIDRO';
    if(/PALHETA/.test(p)&&/(TRASEIRO|VIGIA)/.test(p))return 'PALHETA_TRASEIRA';
    if(/PALHETA/.test(p)&&/(PARABRISA|DIANTEIRO|JOGO)/.test(p))return 'PALHETA_DIANTEIRA';
    if(/TAPETE/.test(p))return 'TAPETE';
    if(/ELEMENTO/.test(p)&&/FILTRO/.test(p)&&/(AR CONDICIONADO|CABINE|A C)/.test(p))return 'FILTRO_CABINE';
    if(/POLIA/.test(p)&&/ALTERNADOR/.test(p)&&!/TENSORA/.test(p))return 'POLIA_ALTERNADOR';
    if(/ESPELHO|RETROVISOR/.test(p))return 'RETROVISOR';
    if(/GUARNICAO/.test(p)&&/PORTA/.test(p))return 'GUARNICAO_PORTA';
    return previousConcept.call(this,p);
  };

  C.matchScore=function(request,offer){
    const a=this.normalizeMatch(request.description),b=this.normalizeMatch(offer.description);
    const ca=this.concept(a),cb=this.concept(b);
    if(ca&&cb){
      const incompatible=(ca==='COXIM_MOTOR'&&cb==='COXIM_CAMBIO')||(ca==='COXIM_CAMBIO'&&cb==='COXIM_MOTOR')||
        (ca==='TENSOR_CORREIA'&&cb==='CORREIA_ALTERNADOR')||(ca==='CORREIA_ALTERNADOR'&&cb==='TENSOR_CORREIA')||
        (ca==='MAQUINA_VIDRO'&&cb==='MOTOR_VIDRO')||(ca==='MOTOR_VIDRO'&&cb==='MAQUINA_VIDRO');
      if(incompatible)return 0;
    }
    let score=previousMatchScore.call(this,request,offer);
    if(ca&&cb&&ca===cb)score+=0.35;
    return score;
  };

  C._sideToken=function(value){
    const p=this.normalizeMatch(value);
    if(/\bESQUERDO\b/.test(p))return 'L';
    if(/\bDIREITO\b/.test(p))return 'R';
    return '';
  };
  C._axleToken=function(value){
    const p=this.normalizeMatch(value);
    if(/\bTRASEIRO\b/.test(p))return 'R';
    if(/\bDIANTEIRO\b|\bPARABRISA\b/.test(p))return 'F';
    return '';
  };

  C.suggestRequestedId=function(offer,offerIndex,totalOffers){
    const requested=this.state.requested||[];
    const normalized=this.normalizeMatch(offer&&offer.description||'');
    const concept=this.concept(normalized);
    const side=this._sideToken(normalized);
    const axle=this._axleToken(normalized);
    const unique=function(list){return list.length===1?list[0].id:'';};

    if(concept==='PALHETA_TRASEIRA'){
      const id=unique(requested.filter(function(r){return C.concept(r.description)==='PALHETA_TRASEIRA';}));
      if(id)return id;
    }
    if(concept==='PALHETA_DIANTEIRA'){
      const front=requested.filter(function(r){
        const p=C.normalizeMatch(r.description),cc=C.concept(r.description);
        return cc==='PALHETA_DIANTEIRA'||(/PALHETA/.test(p)&&!/TRASEIRO/.test(p));
      });
      const id=unique(front);if(id)return id;
    }
    if(['TENSOR_CORREIA','BOMBA_COMBUSTIVEL','BOMBA_AGUA','FECHADURA_CAPO','TAPETE','POLIA_ALTERNADOR'].includes(concept)){
      const id=unique(requested.filter(function(r){return C.concept(r.description)===concept;}));
      if(id)return id;
    }
    if(concept==='MAQUINA_VIDRO'){
      let list=requested.filter(function(r){return C.concept(r.description)==='MAQUINA_VIDRO';});
      if(side)list=list.filter(function(r){return C._sideToken(r.description)===side;});
      if(axle)list=list.filter(function(r){return C._axleToken(r.description)===axle;});
      const id=unique(list);if(id)return id;
    }
    if(concept==='COXIM_MOTOR'){
      let list=requested.filter(function(r){return C.concept(r.description)==='COXIM_MOTOR';});
      if(side)list=list.filter(function(r){return C._sideToken(r.description)===side;});
      const id=unique(list);if(id)return id;
    }

    if(concept && !side){
      const sameConcept=requested.filter(function(r){return C.concept(r.description)===concept;});
      const sides=new Set(sameConcept.map(function(r){return C._sideToken(r.description);}).filter(Boolean));
      if(sameConcept.length>1 && sides.size>1)return '';
    }

    const ranked=requested.map(function(r,index){return {id:r.id,index:index,score:C.matchScore(r,offer),concept:C.concept(r.description)};}).sort(function(a,b){return b.score-a.score;});
    const best=ranked[0],second=ranked[1];
    if(best&&best.score>=0.62){
      if(second&&best.score-second.score<0.10)return '';
      return best.id;
    }
    return previousSuggestRequestedId.call(this,offer,offerIndex,totalOffers)||'';
  };

  C._lastPriceAtEnd=function(segment){
    const raw=String(segment||'').trim();
    const re=/(?:R\$\s*)?(\d{1,7}(?:[.,]\d{1,2})?)\s*(?:reais?)?\s*$/i;
    const m=raw.match(re);
    if(!m)return null;
    return {value:this.num(m[1]),start:m.index,end:(m.index||0)+m[0].length,prefix:raw.slice(0,m.index).trim()};
  };

  C._knownBrandSuffix=function(prefix){
    const raw=String(prefix||'').trim();
    const p=this.plain(raw);
    const brands=this.knownBrands().slice().sort(function(a,b){return C.plain(b).length-C.plain(a).length;});
    for(const brand of brands){
      const bp=this.plain(brand);
      if(p===bp||p.endsWith(' '+bp)){
        const words=raw.split(/\s+/);
        const count=String(brand).trim().split(/\s+/).length;
        return {brand:brand.toUpperCase(),base:words.slice(0,Math.max(0,words.length-count)).join(' ').trim()};
      }
    }
    return null;
  };

  C._parseAlternativeLine=function(line){
    const raw=String(line||'').trim();
    if(!/\s\/\s/.test(raw))return null;
    const parts=raw.split(/\s+\/\s+/).map(function(x){return x.trim();}).filter(Boolean);
    if(parts.length<2)return null;
    const firstPrice=this._lastPriceAtEnd(parts[0]);
    if(!firstPrice||firstPrice.value<=0)return null;
    const firstBrand=this._knownBrandSuffix(firstPrice.prefix);
    if(!firstBrand||!firstBrand.base)return null;
    const alternatives=[{brand:firstBrand.brand,value:firstPrice.value}];
    for(let i=1;i<parts.length;i++){
      const price=this._lastPriceAtEnd(parts[i]);
      if(!price||price.value<=0)return null;
      let brand=String(price.prefix||'').replace(/^[\-–—•]+|[\-–—•]+$/g,'').trim();
      if(!brand)brand='';
      const known=this._knownBrandSuffix(brand);
      if(known&&(!known.base||this.plain(known.base)===this.plain(brand)))brand=known.brand;
      alternatives.push({brand:brand.toUpperCase(),value:price.value});
    }
    return {description:firstBrand.base,alternatives:alternatives,rawLine:raw};
  };

  C.parseOffersLocal=function(text){
    const entries=this.splitSupplierEntries?this.splitSupplierEntries(text):this.splitEntries(text);
    const rows=[];
    let order=0;
    entries.forEach(function(entry){
      const line=String(entry||'').trim();
      if(!line)return;
      const alt=C._parseAlternativeLine(line);
      if(alt){
        alt.alternatives.forEach(function(a,index){
          rows.push(C.normalizeDraft({
            order:order++,description:alt.description,brand:a.brand,code:'',qty:0,qtyShown:false,
            priceType:'unit',value:a.value,extra:0,availability:'available',
            rawLine:alt.rawLine,note:'Alternativa '+(index+1)+' informada pelo fornecedor na mesma linha.'
          }));
        });
        return;
      }
      const parsed=previousParseOffersLocal.call(C,line);
      (parsed.rows||[]).forEach(function(row){rows.push(C.normalizeDraft(Object.assign({},row,{order:order++})));});
    });
    return {rows:rows,documentTotal:0,documentExtra:0};
  };

  C.visionPrompt=function(){
    return 'Leia TODAS as linhas visíveis desta FOTO de cotação automotiva, de cima para baixo. A imagem é a única fonte. Não adapte nomes à lista solicitada, não complete códigos, não invente marca e não elimine linhas parecidas.\n\n'+
      'Responda SOMENTE em linhas separadas por |. Para CADA linha física de produto use EXATAMENTE 9 campos:\n'+
      'CODIGO|DENOMINACAO|UN|COD_FABR|MARCA|QTDE|PRECO_UNIT|VALOR_TOTAL|STATUS\n'+
      'STATUS: A=cotado/disponível; U=explicitamente indisponível; P=parcial/condicional; ?=não informado.\n'+
      'Ao terminar escreva END|N. Se houver total geral visível, escreva TOTAL|VALOR antes de END.\n\n'+
      'REGRAS ABSOLUTAS:\n'+
      '- Leia TODAS as linhas, inclusive quando houver mais de 20. Não resuma.\n'+
      '- Uma linha visual da tabela = uma linha de saída.\n'+
      '- Preserve DENOMINACAO exatamente como aparece.\n'+
      '- A ordem das colunas é fixa: código, denominação, unidade, código fabricante, MARCA, QUANTIDADE, preço unitário, valor total.\n'+
      '- MARCA é texto. Nunca coloque 1, 2, 4 ou qualquer quantidade no campo MARCA.\n'+
      '- QTDE é o número da coluna imediatamente depois da marca.\n'+
      '- Não misture células de linhas vizinhas.\n'+
      '- Se uma célula estiver ilegível, deixe vazia/0. Não adivinhe.\n'+
      '- Não inclua cabeçalho, rodapé nem linha TOTAL como produto.\n'+
      '- Mesmo que duas descrições sejam parecidas, mantenha as duas linhas.\n'+
      '- Use ponto como separador decimal.\n'+
      '- Seja compacto para devolver todas as linhas.';
  };

  C.groqVision=async function(prompt,dataUrl,key,maxTokens){
    if(typeof this.resolveVisionModels!=='function')throw new Error('Modelo de visão não inicializado.');
    const models=await this.resolveVisionModels(key);
    let lastError=null;
    const limit=Math.min(2800,Math.max(1200,this.num(maxTokens)||2400));
    for(const model of models){
      const payload={model:model,temperature:0,max_completion_tokens:limit,messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:dataUrl}}]}]};
      const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await res.json().catch(function(){return {};});
      if(res.ok){this._lastVisionModel=model;return data.choices&&data.choices[0]&&data.choices[0].message?data.choices[0].message.content||'':'';}
      const message=String(data&&data.error&&data.error.message||('Erro Groq Vision '+res.status));
      const err=new Error(message);err.status=res.status;err.model=model;lastError=err;
      const inaccessible=res.status===404||res.status===403||/does not exist|do not have access|not have access|permission|model.+not found|access to it/i.test(message);
      const incompatible=res.status===400&&/model|vision|image|multimodal|unsupported/i.test(message);
      if(inaccessible||incompatible)continue;
      throw err;
    }
    throw lastError||new Error('Nenhum modelo de visão Groq disponível.');
  };

  C.parseVisionTable=function(content){
    const rows=[];let documentTotal=0,reportedCount=0,ended=false;
    String(content||'').replace(/\x60\x60\x60[a-z]*|\x60\x60\x60/gi,'').split(/\r?\n/).forEach(function(line,index){
      const raw=String(line||'').trim();if(!raw)return;
      let cols=raw.indexOf('|')>=0?raw.split('|'):raw.split('\t');
      cols=cols.map(function(x){return String(x||'').trim();});
      if(C.plain(cols[0]||'')==='ROW')cols=cols.slice(1);
      const tag=C.plain(cols[0]||'');
      if(tag==='TOTAL'){documentTotal=C.num(cols[1]);return;}
      if(tag==='END'){reportedCount=Math.max(0,Math.round(C.num(cols[1])));ended=true;return;}
      if(/^(CODIGO|COD|DENOMINACAO)$/.test(tag))return;
      while(cols.length<9)cols.push('');
      if(cols.length>9)cols=cols.slice(0,9);
      const supplierCode=cols[0],description=cols[1],unit=cols[2],code=cols[3];
      let brand=cols[4],qtyRaw=cols[5];
      if(/^\d+(?:[.,]\d+)?$/.test(brand)){
        const maybeKnown=C.knownBrands().find(function(b){return C.plain(b)===C.plain(code);});
        if(maybeKnown){brand=maybeKnown;code='';}
        else brand='';
      }
      const qty=C.num(qtyRaw),unitPrice=C.num(cols[6]),totalPrice=C.num(cols[7]);
      const status=String(cols[8]||'?').trim().toUpperCase();
      const availability=status==='U'?'unavailable':status==='P'?'partial':status==='A'?'available':'unknown';
      const value=unitPrice>0?unitPrice:totalPrice;
      const priceType=unitPrice>0?'unit':totalPrice>0?'total':(availability==='unavailable'?'unavailable':'unknown');
      if(!description&&!supplierCode&&!code&&!brand&&!value)return;
      const note=availability==='unavailable'&&value>0?'Preço preservado como referência histórica; fornecedor informou indisponibilidade.':'';
      rows.push({order:index,supplierCode:supplierCode,description:description,unit:unit,code:code,brand:brand,qty:qty,qtyShown:qtyRaw!==''&&qty>0,unitPrice:unitPrice,totalPrice:totalPrice,quotedTotal:totalPrice,priceType:priceType,value:value,extra:0,availability:availability,note:note,rawLine:raw});
    });
    return {rows:rows,documentTotal:documentTotal,documentExtra:0,reportedCount:reportedCount,complete:ended&&(!reportedCount||reportedCount===rows.length)};
  };

  C._safeDocumentTotal=function(rows,totals){
    const vals=(totals||[]).map(function(v){return C.num(v);}).filter(function(v){return v>0;});
    if(!vals.length)return 0;
    const candidate=Math.max.apply(Math,vals);
    const visible=(rows||[]).reduce(function(sum,row){
      const q=C.num(row.qty)||1;
      const shown=C.num(row.quotedTotal||row.totalPrice);
      const calc=C.num(row.unitPrice)>0?C.num(row.unitPrice)*q:C.num(row.value)*(row.priceType==='unit'?q:1);
      return sum+(shown>0?shown:calc);
    },0);
    if(!visible)return 0;
    const ratio=candidate/visible;
    return ratio>=0.75&&ratio<=1.30?candidate:0;
  };

  C._upgradeImageInputs=function(){
    document.querySelectorAll('input[id^="supplierImage_"]').forEach(function(input){
      input.multiple=true;
      input.setAttribute('multiple','multiple');
      const label=document.querySelector('label[for="'+input.id+'"]');
      if(label)label.innerHTML='<i class="fa-solid fa-camera"></i> Ler foto(s)';
    });
  };

  C.renderSuppliers=function(){
    const out=previousRenderSuppliers.apply(this,arguments);
    this._upgradeImageInputs();
    return out;
  };

  C.processSupplierImage=async function(id,input){
    const s=this.supplier(id),files=Array.from(input&&input.files||[]);
    if(!s||!files.length)return;
    if(!this.state.requested.length){this.toast('Primeiro carregue a lista solicitada.');input.value='';return;}
    const key=this.getGroqKey();
    if(!key){this.toast('A chave Groq não está configurada. Nenhum dado foi incluído.');input.value='';return;}
    s.confirmed=false;s.offers=[];
    s.imageNames=(Array.isArray(s.imageNames)?s.imageNames:[]).concat(files.map(function(f){return f.name;}));
    s.imageName=s.imageNames.join(', ');
    if(this.imagePreviews[id]){try{URL.revokeObjectURL(this.imagePreviews[id]);}catch(e){}}
    this.imagePreviews[id]=URL.createObjectURL(files[files.length-1]);
    const preview=this.$('supplierPreview_'+id);
    if(preview){preview.src=this.imagePreviews[id];preview.classList.add('show');}
    this.setSupplierBusy(id,true,'Lendo '+files.length+' foto(s)...');
    const allRows=[];const totals=[];let completeCount=0;const errors=[];
    try{
      for(let i=0;i<files.length;i++){
        this.setSupplierBusy(id,true,'Lendo foto '+(i+1)+' de '+files.length+'...');
        try{
          const dataUrl=await this.imageToDataURL(files[i],2500,.95);
          const content=await this.groqVision(this.visionPrompt(),dataUrl,key,2500);
          const rawParsed=this.parseVisionTable(content);
          const parsed=this.normalizeParsed(rawParsed,'image');
          if(!parsed.rows.length)throw new Error('Nenhuma linha reconhecida na foto '+(i+1)+'.');
          allRows.push.apply(allRows,parsed.rows);
          if(rawParsed.documentTotal)totals.push(rawParsed.documentTotal);
          if(rawParsed.complete)completeCount++;
        }catch(err){errors.push('Foto '+(i+1)+': '+String(err&&err.message||err));}
      }
      if(!allRows.length)throw new Error(errors[0]||'Nenhuma linha de produto foi reconhecida.');
      const newDrafts=this.buildDraftOffers({rows:allRows,documentTotal:0,documentExtra:0},'image');
      const existing=Array.isArray(s.draftOffers)?s.draftOffers:[];
      s.draftOffers=existing.concat(newDrafts);
      s.documentTotal=this._safeDocumentTotal(allRows,totals);
      s.documentExtra=0;
      this.renderAll();
      const msg=files.length+' foto(s) processada(s): '+allRows.length+' linha(s) adicionada(s).'+(errors.length?' '+errors.length+' foto(s) precisam de nova tentativa.':'')+(completeCount<files.length-errors.length?' Revise as linhas: uma resposta de visão terminou antes do END.':'');
      this.toast(msg);
    }catch(e){
      console.error(e);
      this.renderAll();
      const msg=String(e&&e.message||'');
      if(e&&e.status===429||/rate limit|tokens per minute|too large/i.test(msg))this.toast('A Groq atingiu o limite temporário da visão. Aguarde e tente novamente.');
      else this.toast('As fotos não foram lidas com segurança. Nenhum preço novo foi salvo.');
    }finally{this.setSupplierBusy(id,false);input.value='';this._upgradeImageInputs();}
  };

  C._upgradeImageInputs();
  try{C.renderSuppliers();}catch(e){console.warn('[COTARP V12.1.8] rerender',e);}
  console.info('[COTARP] V12.1.8 aplicada: lista literal, múltiplas fotos, OCR mais longo e alternativas marca/preço preservadas.');
})(0);
