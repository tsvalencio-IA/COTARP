/*
  COTARP V12.1.5 - correção cirúrgica da importação de texto do fornecedor.
  Mantém V12.1.2 + V12.1.3 + V12.1.4 intactas.
  Corrige hífen usado entre descrição e preço, evita confundir medida/código com preço
  e melhora abreviações comuns sem adivinhar aplicação ambígua.
*/
(function applySupplierTextFix(attempt){
  'use strict';

  const C=window.Comparator;
  if(!C || !C.__v1213FixApplied){
    if((attempt||0)<60)setTimeout(()=>applySupplierTextFix((attempt||0)+1),100);
    return;
  }
  if(C.__v1215SupplierTextFixApplied)return;

  C.__v1215SupplierTextFixApplied=true;
  window.COTARP_COMPARE_FIX_VERSION='12.1.5';

  const previousKnownBrands=C.knownBrands;
  C.knownBrands=function(){
    const current=previousKnownBrands.call(this);
    return [...new Set(current.concat(['DAYCO','IMA']))];
  };

  C.parseAvailability=function(line){
    const p=this.plain(line);
    if(/NAO VAI|NAO TEM|SEM ESTOQUE|INDISPONIVEL|ESGOTADO/.test(p))return 'unavailable';
    if(/SO TEM|SOMENTE \d+|PARCIAL|TEM QUE VER (?:O )?MODELO|VER MODELO|CONFIRMAR MODELO|MODELO A CONFIRMAR|SOB CONSULTA|SO TENHO|CONFERIR/.test(p))return 'partial';
    return 'available';
  };

  C.splitSupplierEntries=function(text){
    const source=String(text||'').replace(/\r\n?/g,'\n').replace(/\t+/g,' ');
    const result=[];
    source.split(/\n+|;+/).forEach(block=>{
      const line=String(block||'').trim();
      if(!line)return;

      const parts=line.split(/\s+(?:-|–|—|•|\*)\s+/).map(x=>this.clean(x)).filter(Boolean);
      if(parts.length<=1){result.push(this.clean(line));return;}

      let current=parts[0];
      for(let i=1;i<parts.length;i++){
        const part=parts[i];
        const p=this.plain(part);
        const priceOrStatus=/^(?:R\$\s*)?\d+(?:[.,]\d{1,2})?\b/i.test(part) ||
          /^(NAO TEM|SEM ESTOQUE|INDISPONIVEL|ESGOTADO|CONFERIR|TEM QUE VER|SO TENHO|SOB CONSULTA)\b/.test(p) ||
          /^\(.+\)$/.test(part);
        const startsNewItem=this.looksLikePart(part)||this.beginsQuantity(part);
        if(priceOrStatus || !startsNewItem) current+=` - ${part}`;
        else { if(current.trim())result.push(current.trim()); current=part; }
      }
      if(current.trim())result.push(current.trim());
    });
    return result;
  };

  C.findSupplierPriceToken=function(line,leadingInfo={}){
    const raw=String(line||'');
    const candidates=[];
    const re=/(?:R\$\s*)?(\d{1,7}(?:[.,]\d{1,2})?)/gi;
    for(const m of raw.matchAll(re)){
      const start=m.index||0,end=start+m[0].length,token=m[1];
      if(leadingInfo.shown&&start>=leadingInfo.start&&end<=leadingInfo.end)continue;

      const prev=raw[start-1]||'',next=raw[end]||'';
      if(/[A-Za-zÀ-ÿ]/.test(prev)||/[A-Za-zÀ-ÿ]/.test(next))continue;

      const after=raw.slice(end,end+18);
      if(/^\s*(?:mm|cm|pol|polegadas?|bar|kg|g|ml|l|v|a|w|kw|cv)\b/i.test(after))continue;

      const value=this.num(token);
      if(!value)continue;
      if(value>=1900&&value<=2099&&!/[,.]/.test(token)&&!m[0].includes('R$'))continue;

      const before=raw.slice(Math.max(0,start-14),start);
      if(/(?:COD|C[ÓO]DIGO|REF|REFER[EÊ]NCIA)\s*[:#-]?\s*$/i.test(before)&&!/[,.]/.test(token)&&!m[0].includes('R$'))continue;

      let score=0;
      if(m[0].includes('R$'))score+=8;
      if(/[,.]\d{1,2}$/.test(token))score+=6;
      if(/(?:-|–|—)\s*$/.test(before))score+=5;
      if(/^\s*(?:cada|par|unit[aá]rio|por\s+unidade|por\s+pe[cç]a|total|conjunto)\b/i.test(after))score+=4;
      if(/^\s*\(/.test(after))score+=1;
      candidates.push({match:m,start,end,value,score});
    }
    if(!candidates.length)return null;
    candidates.sort((a,b)=>b.score-a.score || b.start-a.start);
    return candidates[0];
  };

  C.extractSupplierInlineCode=function(line,priceToken){
    const raw=String(line||'');
    const withoutPrice=priceToken?raw.slice(0,priceToken.start)+' '+raw.slice(priceToken.end):raw;
    const matches=withoutPrice.match(/\b[A-Z0-9][A-Z0-9._/-]{3,}\b/gi)||[];
    for(const token of matches){
      const p=this.plain(token);
      if(!/[A-Z]/.test(p)||!/[0-9]/.test(p))continue;
      if(/^\d+(MM|CM|V|A|W|BAR)$/.test(p))continue;
      if(this.knownBrands().some(b=>this.plain(b)===p))continue;
      if(/^(DIANT|DIAN|TRAS|FLEX|ABS)$/.test(p))continue;
      return token.toUpperCase();
    }
    return '';
  };

  C.canonicalSupplierDescription=function(value){
    let text=String(value||'').trim();
    text=text
      .replace(/\bDIAN\.?(?=\s|$)/ig,'DIANTEIRO')
      .replace(/\bDIANT\.?(?=\s|$)/ig,'DIANTEIRO')
      .replace(/\bTRAS\.?(?=\s|$)/ig,'TRASEIRO')
      .replace(/\bKITIS\b/ig,'KITS');
    if(/\bAXIAL\b/i.test(text)&&!/\bBARRA\s+AXIAL\b/i.test(text)) text=text.replace(/\bAXIAL\b/i,'BARRA AXIAL');
    text=text.replace(/\bKIT\s+DENTADA\b/i,'KIT CORREIA DENTADA');
    return text.replace(/\s+/g,' ').trim();
  };

  C.parseOffersLocal=function(text){
    let rows=[];
    const entries=this.splitSupplierEntries(text);

    entries.forEach((raw,index)=>{
      let line=String(raw||'').replace(/^[\-–—•*]+\s*/,'').trim();
      if(!line)return;
      if(this.looksLikeVehicle(line)&&!this.looksLikePart(line))return;

      const availability=this.parseAvailability(line);
      const partial=line.match(/s[oó]\s+tem\s+(\d+(?:[.,]\d+)?)/i);
      const conditional=/tem\s+que\s+ver\s+(?:o\s+)?modelo|ver\s+modelo|confirmar\s+modelo|modelo\s+a\s+confirmar|sob\s+consulta|s[oó]\s+tenho|conferir/i.test(line);
      const lead=this.leadingQuantityInfo(line);
      const token=this.findSupplierPriceToken(line,lead);
      const rawPrice=token?token.value:0;
      const explicitPair=/\bpar\b/i.test(line);
      const each=/\b(cada|unit[aá]rio|por\s+unidade|por\s+pe[cç]a)\b/i.test(line);

      let qty=partial?this.num(partial[1]):(lead.shown?lead.qty:0);
      let qtyShown=lead.shown||!!partial;
      if(!qty&&explicitPair){qty=2;qtyShown=true;}

      if(!rawPrice&&availability==='available')return;

      let priceType='unit';
      if(!rawPrice)priceType=availability==='unavailable'?'unavailable':'unknown';
      else if(each)priceType='unit';
      else if(explicitPair)priceType='total';
      else if(qty>1)priceType='unknown';

      const brand=this.extractBrand(line);
      const code=this.extractSupplierInlineCode(line,token);
      let description=line;
      if(lead.shown)description=description.slice(lead.end);
      if(token){
        const removedLead=lead.shown?lead.end:0;
        const adjustedStart=Math.max(0,token.start-removedLead);
        const adjustedEnd=Math.max(adjustedStart,token.end-removedLead);
        description=description.slice(0,adjustedStart)+description.slice(adjustedEnd);
      }

      description=description
        .replace(/s[oó]\s+tem\s+\d+(?:[.,]\d+)?/ig,' ')
        .replace(/\b(cada|unit[aá]rio|por\s+unidade|por\s+pe[cç]a|reais?)\b/ig,' ')
        .replace(/\b(n[aã]o\s+vai|n[aã]o\s+tem|sem\s+estoque|indispon[ií]vel|esgotado)\b/ig,' ')
        .replace(/\b(tem\s+que\s+ver\s+(?:o\s+)?modelo|ver\s+modelo|confirmar\s+modelo|modelo\s+a\s+confirmar|sob\s+consulta|s[oó]\s+tenho|conferir)\b/ig,' ')
        .replace(/\(\s*conferir\s*\)/ig,' ')
        .replace(/\(\s*\)/g,' ');
      if(explicitPair)description=description.replace(/\bpar\b/ig,' ');
      if(brand){
        const brandPlain=this.plain(brand);
        description=description.split(/\s+/).filter(part=>this.plain(part)!==brandPlain).join(' ');
      }
      description=description.replace(/\s*[-–—]\s*/g,' ').replace(/\s+/g,' ').trim();
      description=this.canonicalSupplierDescription(description)||'ITEM NÃO IDENTIFICADO';

      const notes=[];
      if(partial)notes.push(`Fornecedor informou somente ${qty} unidade(s).`);
      if(conditional)notes.push(/conferir/i.test(line)?'Fornecedor pediu conferência da aplicação/modelo.':'Fornecedor informou condição/modelo a confirmar.');
      if(availability==='unavailable'&&rawPrice>0)notes.push('Preço preservado como referência histórica; fornecedor informou indisponibilidade.');

      rows.push(this.normalizeDraft({
        order:index,description,brand,code,qty,qtyShown,
        priceType,value:rawPrice,extra:0,availability,rawLine:raw,note:notes.join(' ')
      }));
    });

    rows=this.contextualizeKits(rows).map((row,i)=>this.normalizeDraft({...row,order:i}));
    return {rows,documentTotal:0,documentExtra:0};
  };

  const previousNormalizeMatch=C.normalizeMatch;
  C.normalizeMatch=function(value){
    let p=this.plain(value);
    p=p.replace(/\bDIAN\b/g,' DIANTEIRO ').replace(/\bDIANT\b/g,' DIANTEIRO ').replace(/\bTRAS\b/g,' TRASEIRO ');
    if(/\bAXIAL\b/.test(p)&&!/\bBARRA AXIAL\b/.test(p))p=p.replace(/\bAXIAL\b/g,' BARRA AXIAL ');
    p=p.replace(/\bKIT DENTADA\b/g,' KIT CORREIA DENTADA ');
    return previousNormalizeMatch.call(this,p);
  };

  const previousConcept=C.concept;
  C.concept=function(value){
    const p=this.normalizeMatch(value);
    if(/\bBANDEJA\b/.test(p)&&/\bCOMPLETA\b/.test(p))return 'BANDEJA_COMPLETA';
    return previousConcept.call(this,p);
  };

  const previousSuggestRequestedId=C.suggestRequestedId;
  C.suggestRequestedId=function(offer,offerIndex,totalOffers){
    const normalized=this.normalizeMatch(offer?.description||'');
    const requested=this.state.requested||[];
    const unique=(predicate)=>{const list=requested.filter(predicate);return list.length===1?list[0].id:'';};

    if(/^CABO$/.test(normalized)){
      const id=unique(r=>this.concept(r.description)==='CABO_VELA');
      if(id)return id;
    }
    if(/\bJUNTA\b/.test(normalized)&&/\bTAMPA\b/.test(normalized)){
      const id=unique(r=>{const p=this.normalizeMatch(r.description);return /\bJUNTA\b/.test(p)&&/\bTAMPA\b/.test(p);});
      if(id)return id;
    }
    if(/^PASTILHA(?:\s|$)/.test(normalized)){
      const id=unique(r=>/\bPASTILHAS?\b/.test(this.normalizeMatch(r.description)));
      if(id)return id;
    }
    if(/^DISCO(?:\s|$)/.test(normalized)){
      const id=unique(r=>/\bDISCO\b/.test(this.normalizeMatch(r.description)));
      if(id)return id;
    }
    if(/\bBANDEJA\b/.test(normalized)&&/\bCOMPLETA\b/.test(normalized)){
      const id=unique(r=>this.concept(r.description)==='BANDEJA_COMPLETA');
      if(id)return id;
    }

    const found=previousSuggestRequestedId.call(this,offer,offerIndex,totalOffers);
    if(found)return found;
    return '';
  };

  console.info('[COTARP] Correção V12.1.5 aplicada: importação de texto do fornecedor corrigida.');
})(0);
