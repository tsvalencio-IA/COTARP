/* COTARP V12.1.9 — ajuste fino de mapeamento técnico. */
(function applyCotarpV1219(attempt){
  'use strict';
  const C=window.Comparator;
  if(!C||!C.__v1218FidelityFixApplied){if((attempt||0)<80)setTimeout(function(){applyCotarpV1219((attempt||0)+1);},100);return;}
  if(C.__v1219MappingFixApplied)return;
  C.__v1219MappingFixApplied=true;
  window.COTARP_COMPARE_FIX_VERSION='12.1.9';

  const prevNormalize=C.normalizeMatch,prevConcept=C.concept,prevScore=C.matchScore;
  C.normalizeMatch=function(value){
    let p=this.plain(value);
    p=p
      .replace(/\bPARTE\s+D(?:I)?\b/g,' PARTE DIANTEIRA ')
      .replace(/\bPARTE\s+T(?:R)?\b/g,' PARTE TRASEIRA ')
      .replace(/\bKIT\s+C\s+TENSIONADOR\b/g,' KIT COM TENSIONADOR ');
    return prevNormalize.call(this,p);
  };

  C.concept=function(value){
    const p=this.normalizeMatch(value);
    if(/CORREIA/.test(p)&&/(DENTADA|COMANDO)/.test(p))return 'CORREIA_DENTADA';
    if(/BUCHA.*BANDEJA|BANDEJA.*BUCHA/.test(p)){
      if(/PARTE TRASEIRA|BUCHA TRASEIRA/.test(p))return 'BUCHA_BANDEJA_TRASEIRA';
      if(/PARTE DIANTEIRA|BUCHA DIANTEIRA/.test(p))return 'BUCHA_BANDEJA_DIANTEIRA';
    }
    if(/ELEMENTO/.test(p)&&/FILTRO/.test(p)&&/(AR CONDICIONADO|CABINE|A C)/.test(p))return 'FILTRO_CABINE';
    if(/ELEMENTO/.test(p)&&/FILTRO/.test(p)&&/\bAR\b/.test(p)&&!/(AR CONDICIONADO|CABINE|A C)/.test(p))return 'FILTRO_AR_MOTOR';
    return prevConcept.call(this,p);
  };

  C.matchScore=function(request,offer){
    const ca=this.concept(request.description),cb=this.concept(offer.description);
    if((ca==='FILTRO_CABINE'&&cb==='FILTRO_AR_MOTOR')||(ca==='FILTRO_AR_MOTOR'&&cb==='FILTRO_CABINE'))return 0;
    if((ca==='BUCHA_BANDEJA_DIANTEIRA'&&cb==='BUCHA_BANDEJA_TRASEIRA')||(ca==='BUCHA_BANDEJA_TRASEIRA'&&cb==='BUCHA_BANDEJA_DIANTEIRA'))return 0;
    return prevScore.call(this,request,offer);
  };

  console.info('[COTARP] V12.1.9 aplicada: correia dentada/tensor, buchas dianteira/traseira e filtro A/C protegidos.');
})(0);
