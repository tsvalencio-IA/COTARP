/*
  COTARP V12.1.4 - correção de acesso ao modelo de visão Groq.
  Não altera a base V12.1.2 nem a correção V12.1.3.
  Resolve automaticamente um modelo de visão realmente disponível para a chave Groq atual.
*/
(function applyVisionModelAccessFix(attempt){
  'use strict';

  const C=window.Comparator;
  if(!C || !C.__v1213FixApplied){
    if((attempt||0)<60)setTimeout(()=>applyVisionModelAccessFix((attempt||0)+1),100);
    return;
  }
  if(C.__v1214ModelAccessFixApplied)return;

  C.__v1214ModelAccessFixApplied=true;
  window.COTARP_COMPARE_FIX_VERSION='12.1.4';

  C._groqModelsCache=null;
  C._groqModelsCacheAt=0;

  C.listAccessibleGroqModels=async function(key){
    const now=Date.now();
    if(Array.isArray(this._groqModelsCache) && now-this._groqModelsCacheAt<5*60*1000){
      return this._groqModelsCache.slice();
    }
    const res=await fetch('https://api.groq.com/openai/v1/models',{
      method:'GET',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok){
      const err=new Error(data?.error?.message||`Erro Groq Models ${res.status}`);
      err.status=res.status;
      throw err;
    }
    const ids=(Array.isArray(data?.data)?data.data:[])
      .filter(m=>m&&m.active!==false&&m.id)
      .map(m=>String(m.id));
    this._groqModelsCache=ids;
    this._groqModelsCacheAt=now;
    return ids.slice();
  };

  C.resolveVisionModels=async function(key){
    const configured=String(window.SOS_CONFIG?.GROQ_VISION_MODEL||'').trim();
    const preferred=[
      'qwen/qwen3.8-27b',
      configured,
      'qwen/qwen3.6-27b',
      'qwen/qwen3-vl-32b-instruct'
    ].filter(Boolean);
    const unique=[...new Set(preferred)];

    try{
      const accessible=await this.listAccessibleGroqModels(key);
      const set=new Set(accessible);
      const available=unique.filter(id=>set.has(id));
      if(available.length)return available;

      // Não escolhe um modelo textual por engano. Se nenhum modelo de visão conhecido
      // estiver liberado para esta chave, deixa a chamada falhar com mensagem verdadeira.
      const err=new Error('Nenhum modelo de visão conhecido está liberado para esta chave Groq.');
      err.status=404;
      err.code='NO_ACCESSIBLE_VISION_MODEL';
      err.accessibleModels=accessible;
      throw err;
    }catch(e){
      if(e?.code==='NO_ACCESSIBLE_VISION_MODEL')throw e;
      console.warn('[COTARP] Não foi possível consultar /models; tentando modelos de visão conhecidos em sequência.',e);
      return unique;
    }
  };

  C.groqVision=async function(prompt,dataUrl,key,maxTokens=900){
    const models=await this.resolveVisionModels(key);
    let lastError=null;

    for(const model of models){
      const payload={
        model,
        temperature:0,
        max_completion_tokens:Math.min(900,Math.max(300,this.num(maxTokens)||900)),
        messages:[{
          role:'user',
          content:[
            {type:'text',text:prompt},
            {type:'image_url',image_url:{url:dataUrl}}
          ]
        }]
      };

      console.info(`[COTARP] Tentando modelo de visão Groq: ${model}`);
      const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
        method:'POST',
        headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data=await res.json().catch(()=>({}));

      if(res.ok){
        this._lastVisionModel=model;
        if(window.SOS_CONFIG)window.SOS_CONFIG.GROQ_VISION_MODEL=model;
        console.info(`[COTARP] Modelo de visão ativo: ${model}`);
        return data.choices?.[0]?.message?.content||'';
      }

      const message=String(data?.error?.message||`Erro Groq Vision ${res.status}`);
      const err=new Error(message);
      err.status=res.status;
      err.model=model;
      lastError=err;

      const inaccessible=res.status===404 || res.status===403 ||
        /does not exist|do not have access|not have access|permission|model.+not found|access to it/i.test(message);
      const incompatible=res.status===400 && /model|vision|image|multimodal|unsupported/i.test(message);

      if(inaccessible || incompatible){
        console.warn(`[COTARP] Modelo de visão indisponível para esta chave: ${model}`,message);
        continue;
      }
      throw err;
    }

    const finalError=lastError||new Error('Nenhum modelo de visão Groq disponível para esta chave.');
    finalError.code=finalError.code||'NO_ACCESSIBLE_VISION_MODEL';
    throw finalError;
  };

  console.info('[COTARP] Correção V12.1.4 aplicada: seleção automática do modelo de visão Groq.');
})(0);
