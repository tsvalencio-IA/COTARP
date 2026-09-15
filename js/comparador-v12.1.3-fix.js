/*
  COTARP V12.1.3 - correção aditiva do comparador.
  Base V12.1.2 permanece intacta.
  Objetivos: leitura fiel de foto, texto e áudio; preservar códigos/marcas/preços;
  não transformar suposição em dado confirmado; agrupar pares LE/LD somente quando comprováveis.
*/
(function applyComparatorFix(attempt){
  'use strict';
  const C=window.Comparator;
  if(!C){
    if((attempt||0)<40)setTimeout(()=>applyComparatorFix((attempt||0)+1),100);
    return;
  }
  if(C.__v1213FixApplied)return;
  C.__v1213FixApplied=true;
  window.COTARP_COMPARE_FIX_VERSION='12.1.3';

  const originalKnownBrands=C.knownBrands;
  C.knownBrands=function(){
    const current=originalKnownBrands.call(this);
    return [...new Set(current.concat(['FRASLE','FRAS-LE','GATES','CONTITECH']))];
  };

  const originalContinuation=C.isContinuationFragment;
  C.isContinuationFragment=function(value){
    const p=this.plain(value);
    if(/^(NAO TEM|SEM ESTOQUE|INDISPONIVEL|ESGOTADO|TEM QUE VER (?:O )?MODELO|VER MODELO|CONFIRMAR MODELO|MODELO A CONFIRMAR|SOB CONSULTA)$/.test(p))return true;
    return originalContinuation.call(this,value);
  };

  C.parseAvailability=function(line){
    const p=this.plain(line);
    if(/NAO VAI|NAO TEM|SEM ESTOQUE|INDISPONIVEL|ESGOTADO/.test(p))return 'unavailable';
    if(/SO TEM|SOMENTE \d+|PARCIAL|TEM QUE VER (?:O )?MODELO|VER MODELO|CONFIRMAR MODELO|MODELO A CONFIRMAR|SOB CONSULTA/.test(p))return 'partial';
    return 'available';
  };

  C.parseOffersLocal=function(text){
    let rows=[];
    const entries=this.splitEntries(text);
    entries.forEach((raw,index)=>{
      let line=String(raw||'').replace(/^[\-–—•*]+\s*/,'').trim();
      if(!line)return;
      if(this.looksLikeVehicle(line)&&!this.looksLikePart(line))return;

      const availability=this.parseAvailability(line);
      const partial=line.match(/s[oó]\s+tem\s+(\d+(?:[.,]\d+)?)/i);
      const conditional=/tem\s+que\s+ver\s+(?:o\s+)?modelo|ver\s+modelo|confirmar\s+modelo|modelo\s+a\s+confirmar|sob\s+consulta/i.test(line);
      const lead=this.leadingQuantityInfo(line);
      const qty=partial?this.num(partial[1]):(lead.shown?lead.qty:0);
      const token=this.priceToken(line,lead);
      const rawPrice=token?token.value:0;

      if(!rawPrice&&availability==='available')return;

      const each=/\b(cada|unit[aá]rio|por\s+unidade|por\s+pe[cç]a)\b/i.test(line);
      const afterPrice=token?line.slice(token.end):'';
      const explicitPair=/\bpar\b/i.test(afterPrice)||/\b(par\s+por|valor\s+do\s+par|total\s+do\s+par)\b/i.test(line);
      const explicitTotal=/\b(total|valor\s+total|conjunto)\b/i.test(line)||explicitPair;
      let priceType='unit';
      if(!rawPrice&&availability==='unavailable')priceType='unavailable';
      else if(each)priceType='unit';
      else if(qty>1&&explicitTotal)priceType='total';
      else if(qty>1)priceType='unknown';

      const brand=this.extractBrand(line);
      let description=line;
      if(lead.shown)description=description.slice(lead.end);
      if(token){
        const adjustedStart=Math.max(0,token.start-(lead.shown?lead.end:0));
        const adjustedEnd=Math.max(adjustedStart,token.end-(lead.shown?lead.end:0));
        description=description.slice(0,adjustedStart)+description.slice(adjustedEnd);
      }
      description=description
        .replace(/s[oó]\s+tem\s+\d+(?:[.,]\d+)?/ig,' ')
        .replace(/\b(cada|unit[aá]rio|por\s+unidade|por\s+pe[cç]a|reais?|n[aã]o\s+vai|n[aã]o\s+tem|sem\s+estoque|indispon[ií]vel|esgotado)\b/ig,' ')
        .replace(/\b(tem\s+que\s+ver\s+(?:o\s+)?modelo|ver\s+modelo|confirmar\s+modelo|modelo\s+a\s+confirmar|sob\s+consulta)\b/ig,' ');
      if(explicitPair)description=description.replace(/\bpar\b/ig,' ');
      if(brand)description=description.split(/\s+/).filter(token=>this.plain(token)!==this.plain(brand)).join(' ');
      description=description.replace(/\s+/g,' ').replace(/\s*[-–—]\s*$/,'').trim()||'ITEM NÃO IDENTIFICADO';

      const notes=[];
      if(partial)notes.push(`Fornecedor informou somente ${qty} unidade(s).`);
      if(conditional)notes.push('Fornecedor informou que o modelo/aplicação precisa ser confirmado.');
      if(availability==='unavailable'&&rawPrice>0)notes.push('Preço preservado como referência histórica; fornecedor informou indisponibilidade.');

      rows.push(this.normalizeDraft({
        order:index,description,brand,code:'',qty,qtyShown:lead.shown||!!partial,
        priceType,value:rawPrice,extra:0,availability,rawLine:raw,note:notes.join(' ')
      }));
    });
    rows=this.contextualizeKits(rows).map((row,i)=>this.normalizeDraft({...row,order:i}));
    return {rows,documentTotal:0,documentExtra:0};
  };

  const originalNormalizeMatch=C.normalizeMatch;
  C.normalizeMatch=function(value){
    let p=this.plain(value);
    const pre=[
      [/\bUNIDADES?\b/g,' '],[/\bJOGOS?\b/g,' '],[/\bKITIS\b/g,' KIT '],
      [/\bDIANT\b/g,' DIANTEIRO '],[/\bTRAS\b/g,' TRASEIRO '],
      [/\bDIANTEIRAS?\b/g,' DIANTEIRO '],[/\bTRASEIRAS?\b/g,' TRASEIRO '],
      [/\bCOMPLETAS?\b/g,' COMPLETA '],[/\bVELAS\b/g,' VELA '],[/\bCABOS\b/g,' CABO '],
      [/\bDISCOS\b/g,' DISCO '],[/\bROLAMENTOS\b/g,' ROLAMENTO '],[/\bCORREIAS\b/g,' CORREIA '],
      [/\bBIELETAS\b/g,' BIELETA '],[/\bARTICULADOR(?: CAIXA DIRECAO)?\b/g,' BARRA AXIAL '],
      [/\bPARTE DIANTEIRO\b/g,' PARTE DIANTEIRA '],[/\bPARTE TRASEIRO\b/g,' PARTE TRASEIRA ']
    ];
    pre.forEach(([r,v])=>p=p.replace(r,v));
    return originalNormalizeMatch.call(this,p);
  };

  const originalConcept=C.concept;
  C.concept=function(value){
    const p=this.normalizeMatch(value);
    if(/CABO.*VELA|VELA.*CABO/.test(p))return 'CABO_VELA';
    if(/BARRA AXIAL|ARTICULADOR/.test(p))return 'BARRA_AXIAL';
    if(/CUBO.*RODA|RODA.*CUBO|\bCUBO\b/.test(p))return 'CUBO_RODA';
    if(/ROLAMENTO.*RODA|RODA.*ROLAMENTO/.test(p))return 'ROLAMENTO_RODA';
    if(/DISCO.*FREIO|FREIO.*DISCO/.test(p))return 'DISCO_FREIO';
    if(/PASTILHA.*FREIO|FREIO.*PASTILHA/.test(p))return 'PASTILHA_FREIO';
    if(/\bVELA\b/.test(p))return 'VELA';
    if(/BUCHA.*BANDEJA|BANDEJA.*BUCHA/.test(p)){
      if(/PARTE TRASEIRA|BUCHA TRASEIRO|BUCHA TRASEIRA/.test(p))return 'BUCHA_BANDEJA_TRASEIRA';
      if(/PARTE DIANTEIRA|BUCHA DIANTEIRO|BUCHA DIANTEIRA/.test(p))return 'BUCHA_BANDEJA_DIANTEIRA';
      return 'BUCHA_BANDEJA';
    }
    if(/\bBANDEJA\b/.test(p)&&/COMPLETA/.test(p))return 'BANDEJA_COMPLETA';
    if(/\bBANDEJA\b/.test(p))return 'BANDEJA';
    if(/\bBIELETA\b/.test(p))return 'BIELETA';
    if(/CORREIA/.test(p)&&/ALTERNADOR/.test(p))return 'CORREIA_ALTERNADOR';
    if(/CORREIA/.test(p)&&/(AR CONDICIONADO|ACD)/.test(p))return 'CORREIA_AR';
    if(/CORREIA/.test(p)&&/(DENTADA|COMANDO|TENSIONADOR)/.test(p))return 'CORREIA_DENTADA';
    return originalConcept.call(this,p);
  };

  C.matchScore=function(request,offer){
    const a=this.normalizeMatch(request.description),b=this.normalizeMatch(offer.description);
    if(!a||!b)return 0;
    const frontA=/DIANTEIRO/.test(a),rearA=/TRASEIRO/.test(a),frontB=/DIANTEIRO/.test(b),rearB=/TRASEIRO/.test(b);
    const inA=/INTERNA/.test(a),outA=/EXTERNA/.test(a),inB=/INTERNA/.test(b),outB=/EXTERNA/.test(b);
    const lowerA=/INFERIOR/.test(a),upperA=/SUPERIOR/.test(a),lowerB=/INFERIOR/.test(b),upperB=/SUPERIOR/.test(b);
    const rightA=/DIREITO/.test(a),leftA=/ESQUERDO/.test(a),rightB=/DIREITO/.test(b),leftB=/ESQUERDO/.test(b);
    const ca=this.concept(a),cb=this.concept(b);
    const positionalBushing=String(ca).startsWith('BUCHA_BANDEJA_')&&String(cb).startsWith('BUCHA_BANDEJA_');
    if(!positionalBushing&&((frontA&&rearB)||(rearA&&frontB)||(inA&&outB)||(outA&&inB)||(lowerA&&upperB)||(upperA&&lowerB)||(rightA&&leftB)||(leftA&&rightB)))return 0;
    const A=new Set(a.split(' ').filter(w=>w.length>2)),B=new Set(b.split(' ').filter(w=>w.length>2));
    const inter=[...A].filter(x=>B.has(x)).length,union=new Set([...A,...B]).size||1;
    let score=inter/union;
    if(a===b)score+=1;
    if(a.includes(b)||b.includes(a))score+=.4;
    if(ca&&cb&&ca===cb)score+=1;
    if(ca==='COXIM_CAMBIO'&&cb==='COXIM_CAMBIO'&&((lowerA&&lowerB)||(upperA&&upperB)))score+=.75;
    if(ca==='KIT'&&cb==='KIT_AMORTECEDOR')score+=.35;
    if((ca==='LIGACAO_BARRA'&&cb==='PIVO')||(ca==='PIVO'&&cb==='LIGACAO_BARRA'))score+=.72;
    return score;
  };

  C.visionPrompt=function(){
    return `Leia TODAS as linhas visíveis desta foto de cotação automotiva, de cima para baixo. A imagem é a única fonte. Não adapte nomes à lista do orçamento, não complete códigos, não corrija marca e não elimine linhas parecidas ou repetidas.

Responda SOMENTE em linhas compactas separadas por |, sem JSON, sem markdown e sem explicações.
Para CADA linha física de produto use EXATAMENTE 9 campos:
CODIGO|DENOMINACAO|UN|COD_FABR|MARCA|QTDE|PRECO_UNIT|VALOR_TOTAL|STATUS
STATUS: A=cotado/disponível, U=explicitamente indisponível/sem estoque, P=condicional/parcial, ?=não informado.
No final escreva obrigatoriamente END|N, onde N é a quantidade de linhas de produto que você devolveu. Se houver total geral visível, antes do END escreva TOTAL|VALOR.

REGRAS ABSOLUTAS:
- Leia todas as linhas da tabela. Não resuma e não escolha só alguns itens.
- Preserve a DENOMINACAO exatamente como aparece na foto.
- Copie cada célula para sua coluna correta: código, denominação, unidade, código fabricante, marca, quantidade, preço unitário e valor total.
- Não misture dados de linhas vizinhas.
- Se uma célula estiver ilegível, deixe o campo vazio; não invente.
- Se preço ou quantidade estiverem ilegíveis, deixe vazio/0; não estime.
- Não inclua cabeçalho, rodapé nem a linha TOTAL como produto.
- Mesmo que duas descrições sejam parecidas, mantenha as duas linhas separadas.
- Use ponto como separador decimal na saída numérica.
- Se houver preço em item marcado indisponível, preserve o preço e marque U.
- A resposta deve ser compacta para caber no limite, mas deve conter TODAS as linhas.`;
  };

  C.groqVision=async function(prompt,dataUrl,key,maxTokens=1000){
    const payload={
      model:this.getVisionModel(),temperature:0,max_completion_tokens:Math.min(1000,Math.max(300,this.num(maxTokens)||1000)),reasoning_effort:'none',
      messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:dataUrl}}]}]
    };
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok){const err=new Error(data.error?.message||`Erro Groq Vision ${res.status}`);err.status=res.status;throw err;}
    return data.choices?.[0]?.message?.content||'';
  };

  C.parseVisionTable=function(content){
    const rows=[];let documentTotal=0,reportedCount=0,ended=false;
    String(content||'').replace(/```[a-z]*|```/gi,'').split(/\r?\n/).forEach((line,index)=>{
      const raw=String(line||'').trim();if(!raw)return;
      let cols=raw.includes('|')?raw.split('|'):raw.split('\t');
      cols=cols.map(x=>String(x||'').trim());
      if(cols[0]==='ROW')cols=cols.slice(1);
      const tag=this.plain(cols[0]||'');
      if(tag==='TOTAL'){documentTotal=this.num(cols[1]);return;}
      if(tag==='END'){reportedCount=Math.max(0,Math.round(this.num(cols[1])));ended=true;return;}
      if(/^(CODIGO|COD|DENOMINACAO)$/.test(tag))return;
      while(cols.length<9)cols.push('');
      const supplierCode=cols[0],description=cols[1],unit=cols[2],code=cols[3],brand=cols[4],qtyRaw=cols[5];
      const qty=this.num(qtyRaw),unitPrice=this.num(cols[6]),totalPrice=this.num(cols[7]);
      const status=String(cols[8]||'?').trim().toUpperCase();
      const availability=status==='U'?'unavailable':status==='P'?'partial':status==='A'?'available':'unknown';
      const value=unitPrice>0?unitPrice:totalPrice;
      const priceType=unitPrice>0?'unit':totalPrice>0?'total':(availability==='unavailable'?'unavailable':'unknown');
      if(!description&&!supplierCode&&!code&&!brand&&!value)return;
      const note=availability==='unavailable'&&value>0?'Preço preservado como referência histórica; fornecedor informou indisponibilidade.':'';
      rows.push({order:index,supplierCode,description,unit,code,brand,qty,qtyShown:qtyRaw!==''&&qty>0,unitPrice,totalPrice,quotedTotal:totalPrice,priceType,value,extra:0,availability,note,rawLine:raw});
    });
    return {rows,documentTotal,documentExtra:0,reportedCount,complete:ended&&(!reportedCount||reportedCount===rows.length)};
  };

  C.imageToDataURL=function(file,maxSide=2300,quality=.94){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('Falha ao abrir a imagem.'));
      reader.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('Imagem inválida.'));
        img.onload=()=>{
          const longest=Math.max(img.width,img.height)||1;
          const upscale=longest<1800?Math.min(1.45,maxSide/longest):1;
          const scale=Math.min(maxSide/longest,Math.max(1,upscale));
          const canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(img.width*scale));
          canvas.height=Math.max(1,Math.round(img.height*scale));
          const ctx=canvas.getContext('2d',{alpha:false});
          ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
          ctx.filter='contrast(1.08) saturate(.96)';
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          ctx.filter='none';
          resolve(canvas.toDataURL('image/jpeg',quality));
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  C.processSupplierImage=async function(id,input){
    const s=this.supplier(id),file=input?.files?.[0];if(!s||!file)return;
    if(!this.state.requested.length){this.toast('Primeiro carregue a lista solicitada.');input.value='';return;}
    const key=this.getGroqKey();
    if(!key){this.toast('A chave Groq não está configurada. Nenhum dado foi incluído.');input.value='';return;}
    s.imageName=file.name;s.confirmed=false;s.offers=[];
    if(this.imagePreviews[id]){try{URL.revokeObjectURL(this.imagePreviews[id]);}catch(e){}}
    this.imagePreviews[id]=URL.createObjectURL(file);
    const preview=this.$(`supplierPreview_${id}`);
    if(preview){preview.src=this.imagePreviews[id];preview.classList.add('show');}
    this.setSupplierBusy(id,true,'Lendo todas as linhas da foto...');
    try{
      const dataUrl=await this.imageToDataURL(file,2300,.94);
      const content=await this.groqVision(this.visionPrompt(),dataUrl,key,1000);
      const rawParsed=this.parseVisionTable(content);
      const parsed=this.normalizeParsed(rawParsed,'image');
      if(!parsed.rows.length)throw new Error('Nenhuma linha de produto foi reconhecida.');
      this.applyDraft(s,parsed,'image');
      if(rawParsed.complete)this.toast(`${parsed.rows.length} linha(s) da foto foram lidas. Confira antes de salvar.`);
      else this.toast(`Foram lidas ${parsed.rows.length} linha(s), mas a resposta terminou sem confirmação de fechamento. Revise antes de salvar.`);
    }catch(e){
      console.error(e);
      s.draftOffers=[];s.confirmed=false;s.offers=[];this.renderAll();
      const msg=String(e?.message||'');
      if(e?.status===429||/rate limit|tokens per minute|too large/i.test(msg))this.toast('A Groq atingiu o limite temporário da visão. Nenhum dado foi salvo. Aguarde e tente novamente.');
      else this.toast('A foto não foi lida com segurança. Nenhum preço foi salvo.');
    }finally{this.setSupplierBusy(id,false);input.value='';}
  };

  C.supplierTranscriptPrompt=function(text){
    return `Você recebe a transcrição de um fornecedor de autopeças. Extraia somente o que foi realmente dito e devolva TODAS as peças, sem inventar marca, preço, quantidade ou disponibilidade.

Saída: uma linha por item no formato compacto:
ITEM|DESCRICAO|MARCA|QTDE|PRECO|TIPO|STATUS|NOTA
TIPO: U=preço por unidade; T=preço total da linha/par/conjunto; ?=não ficou claro; X=sem preço.
STATUS: A=tem/cotou; N=não tem/sem estoque; P=condicional/parcial/precisa confirmar modelo.
No final escreva END|N.

Regras:
- "2 discos ... 147 par" = QTDE 2, PRECO 147, TIPO T.
- "2 peças ... 59,50 cada" = QTDE 2, PRECO 59.50, TIPO U.
- Quando houver quantidade maior que 1 e não disser "cada" nem "par/total/conjunto", use TIPO ?; não adivinhe.
- "não tem" = STATUS N e TIPO X, salvo se também houver preço, caso em que preserve o preço.
- "tem que ver modelo", "confirmar modelo" ou equivalente = STATUS P e preserve o preço se houver.
- Preserve a descrição da peça e a marca falada; não troque por sinônimos da lista solicitada.
- Não crie itens ausentes.

TRANSCRIÇÃO REAL:\n${text}`;
  };

  C.parseSupplierTranscriptAI=function(content){
    const rows=[];let reportedCount=0,ended=false;
    String(content||'').replace(/```[a-z]*|```/gi,'').split(/\r?\n/).forEach((line,index)=>{
      const raw=String(line||'').trim();if(!raw)return;
      const cols=raw.split('|').map(x=>String(x||'').trim());
      const tag=this.plain(cols[0]||'');
      if(tag==='END'){reportedCount=Math.max(0,Math.round(this.num(cols[1])));ended=true;return;}
      if(tag!=='ITEM')return;
      while(cols.length<8)cols.push('');
      const description=cols[1],brand=cols[2],qty=this.num(cols[3]),value=this.num(cols[4]);
      const type=String(cols[5]||'?').trim().toUpperCase(),status=String(cols[6]||'A').trim().toUpperCase();
      const availability=status==='N'?'unavailable':status==='P'?'partial':'available';
      let priceType=type==='U'?'unit':type==='T'?'total':type==='X'?'unavailable':'unknown';
      if(value>0&&priceType==='unavailable')priceType=qty>1?'unknown':'unit';
      const note=cols[7]||'';
      if(!description&&!value&&availability!=='unavailable')return;
      rows.push({order:index,description,brand,code:'',qty,qtyShown:qty>0,priceType,value,extra:0,availability,note,rawLine:raw});
    });
    return {rows,documentTotal:0,documentExtra:0,reportedCount,complete:ended&&(!reportedCount||reportedCount===rows.length)};
  };

  C.extractSupplierTranscriptWithAI=async function(text,key){
    const payload={
      model:this.getTextModel(),temperature:0,max_completion_tokens:1200,
      messages:[{role:'system',content:'Você é um extrator fiel de cotação automotiva. Extraia somente o que foi dito, em formato compacto e sem inventar.'},{role:'user',content:this.supplierTranscriptPrompt(text)}]
    };
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json();
    if(!res.ok){const err=new Error(data.error?.message||`Erro Groq ${res.status}`);err.status=res.status;throw err;}
    return this.parseSupplierTranscriptAI(data.choices?.[0]?.message?.content||'');
  };

  C.transcribeSupplierAudio=async function(id,blob,name='cotacao.webm'){
    const s=this.supplier(id);if(!s)return;
    if(!this.state.requested.length){this.toast('Primeiro carregue a lista solicitada.');return;}
    const key=this.getGroqKey();
    if(!key||key.includes('COLE_')){this.toast('Configure a chave Groq.');return;}
    this.setSupplierBusy(id,true,'Transcrevendo áudio...');
    const fd=new FormData();
    fd.append('file',blob,name);
    fd.append('model',window.SOS_CONFIG?.GROQ_TRANSCRIPTION_MODEL||'whisper-large-v3-turbo');
    fd.append('language','pt');fd.append('response_format','json');
    try{
      const res=await fetch('https://api.groq.com/openai/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:fd});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error?.message||'Erro na transcrição');
      const transcript=String(data.text||'').trim();
      if(!transcript){this.toast('Transcrição veio vazia.');return;}
      s.responseText=[String(s.responseText||'').trim(),transcript].filter(Boolean).join('\n');
      this.setSupplierBusy(id,true,'Interpretando a cotação falada...');
      let parsed;
      try{parsed=await this.extractSupplierTranscriptWithAI(transcript,key);}
      catch(aiError){console.warn('Interpretação por IA do áudio falhou; usando parser local.',aiError);parsed=this.parseOffersLocal(transcript);}
      parsed=this.normalizeParsed(parsed,'audio');
      this.applyDraft(s,parsed,'audio');
      this.toast(`Áudio transcrito e ${parsed.rows.length} item(ns) interpretado(s). Confira antes de salvar.`);
    }catch(e){console.error(e);this.toast('Falha na transcrição Groq. Nenhum preço foi salvo.');}
    finally{this.setSupplierBusy(id,false);}
  };

  C.sideOf=function(value){
    const p=this.plain(value);
    if(/\b(LE|ESQUERD[OA]|ESQ)\b/.test(p))return 'L';
    if(/\b(LD|DIREIT[OA]|DIR)\b/.test(p))return 'R';
    return '';
  };
  C.offerBaseBeforeExtra=function(o){
    const qty=Math.max(.0001,this.num(o?.qty)||1);
    if(o?.priceType==='unit')return this.num(o.value)*qty;
    if(o?.priceType==='total')return this.num(o.value);
    return 0;
  };
  C.aggregateSidePairs=function(offers){
    const list=(offers||[]).map(o=>this.normalizeDraft({...o,id:o.id||this.id('off')}));
    const used=new Set(),paired=[],groups=new Map();
    list.forEach(o=>{
      const request=this.state.requested.find(r=>r.id===o.requestedId);
      if(!request||Math.abs(this.num(request.qty)-2)>.0001||this.sideOf(request.description))return;
      const side=this.sideOf(`${o.description} ${o.rawLine}`);
      if(!side||this.num(o.qty)!==1||!['unit','total'].includes(o.priceType)||this.num(o.value)<=0)return;
      const brandKey=this.plain(o.brand)||'SEM_MARCA';
      const concept=this.concept(o.description)||this.semanticKey(o.description);
      const key=`${request.id}::${brandKey}::${concept}`;
      if(!groups.has(key))groups.set(key,{request,L:[],R:[]});
      groups.get(key)[side].push(o);
    });
    groups.forEach(group=>{
      group.L.sort((a,b)=>a.order-b.order);group.R.sort((a,b)=>a.order-b.order);
      const count=Math.min(group.L.length,group.R.length);
      for(let i=0;i<count;i++){
        const left=group.L[i],right=group.R[i];
        const baseLeft=this.offerBaseBeforeExtra(left),baseRight=this.offerBaseBeforeExtra(right);
        if(baseLeft<=0||baseRight<=0)continue;
        const availability=(left.availability==='unavailable'||right.availability==='unavailable')?'unavailable':(left.availability==='partial'||right.availability==='partial')?'partial':'available';
        paired.push(this.normalizeDraft({
          id:this.id('pair'),order:Math.min(left.order,right.order),description:group.request.description,
          brand:left.brand||right.brand,code:[left.code,right.code].filter(Boolean).join(' / '),supplierCode:[left.supplierCode,right.supplierCode].filter(Boolean).join(' / '),
          unitLabel:'PAR',quotedTotal:baseLeft+baseRight,qty:2,qtyShown:true,priceType:'total',value:baseLeft+baseRight,
          extra:this.num(left.extra)+this.num(right.extra),availability,
          note:[left.note,right.note,'Par LE/LD agrupado automaticamente a partir de duas linhas da mesma cotação.'].filter(Boolean).join(' '),
          rawLine:[left.rawLine,right.rawLine].filter(Boolean).join(' || '),requestedId:group.request.id,source:'paired'
        }));
        used.add(left.id);used.add(right.id);
      }
    });
    return list.filter(o=>!used.has(o.id)).concat(paired).sort((a,b)=>a.order-b.order);
  };

  C.confirmSupplier=function(id){
    const s=this.supplier(id);if(!s)return;
    const validation=this.draftValidation(s);
    if(!validation.valid.length){this.toast('Ainda não existe nenhum preço pronto para salvar.');this.renderDraftStatus(id,true);return;}
    s.offers=this.aggregateSidePairs(validation.valid);
    this.cleanupPurchaseSelections(id);
    s.confirmed=true;s.confirmedAt=new Date().toISOString();
    this.normalizeUI();this.state.ui.supplierOpen[id]=false;this.state.ui.panels.suppliers=true;
    const currentIndex=this.state.suppliers.findIndex(x=>x.id===id);
    const next=this.state.suppliers.slice(currentIndex+1).find(x=>!x.confirmed)||null;
    if(next)this.state.ui.supplierOpen[next.id]=true;else this.state.ui.panels.results=true;
    this.renderAll();
    const ignored=validation.pending.length;
    if(next){
      this.scrollToElement(`supplierCard_${next.id}`,`#supplierText_${next.id}`);
      this.toast(`${s.name}: ${s.offers.length} preço(s) salvo(s)${ignored?` e ${ignored} linha(s) não usada(s)`:''}. O próximo fornecedor foi aberto.`);
    }else{
      this.scrollToElement('compareResultsPanel');
      this.toast(`${s.name}: ${s.offers.length} preço(s) salvo(s). A comparação foi aberta.`);
    }
  };

  const originalOfferResult=C.offerResult;
  C.offerResult=function(s,r,o){
    const result=originalOfferResult.call(this,s,r,o);
    const reqQty=this.num(r.qty)||1,quotedQty=this.num(o.qty)||reqQty;
    const sideSpecificShort=!result.unavailable&&reqQty>1&&!this.sideOf(r.description)&&!!this.sideOf(`${o.description} ${o.rawLine}`)&&quotedQty<reqQty;
    if(sideSpecificShort){
      result.partial=true;result.enough=false;result.offeredQty=quotedQty;
      const singleBase=this.offerBaseBeforeExtra(o),extra=this.num(o.extra);
      result.baseTotal=singleBase;result.extraTotal=extra;result.total=singleBase+extra;result.unitCost=result.total/Math.max(.0001,quotedQty);
    }
    return result;
  };

  const originalOfferOptionHTML=C.offerOptionHTML;
  C.offerOptionHTML=function(offer,winner){
    if(offer?.unavailable&&this.num(offer.quotedUnit)>0){
      const classes=['compare-matrix-option','unavailable'];
      const historical=`<div class="compare-option-prices"><span>${this.money(offer.quotedUnit)} <small>referência</small></span><strong>INDISPONÍVEL</strong></div>`;
      return `<div class="${classes.join(' ')}"><div class="compare-option-top"><b>${this.esc(offer.brand||'SEM MARCA')}</b><span>NÃO TEM</span></div>${offer.code?`<small>Cód. ${this.esc(offer.code)}</small>`:''}${historical}${offer.note?`<small>${this.esc(offer.note)}</small>`:''}</div>`;
    }
    return originalOfferOptionHTML.call(this,offer,winner);
  };

  console.info('[COTARP] Correção do comparador V12.1.3 aplicada.');
})(0);
