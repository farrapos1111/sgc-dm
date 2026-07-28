var e=[`janeiro`,`fevereiro`,`março`,`abril`,`maio`,`junho`,`julho`,`agosto`,`setembro`,`outubro`,`novembro`,`dezembro`],t=[`domingo`,`segunda-feira`,`terça-feira`,`quarta-feira`,`quinta-feira`,`sexta-feira`,`sábado`];function n(e){return String(e).padStart(2,`0`)}function r(e){return`${n(e.getDate())}/${n(e.getMonth()+1)}/${e.getFullYear()}`}function i(e){return`${n(e.getHours())}:${n(e.getMinutes())}`}var a=`🔺🗝️ CHAVE DIA [data]🗝️🔺

—————🕯️🕯️🕯️🕯️🕯️🕯️🕯️—————

Neste [dia_semana], dia [dia] de [mes] de [ano], teremos a pauta [titulo].

[descricao]

📆 Data: [data]
📍 Local: [local]
🕴️ Traje: [traje]
📍 Pauta: [titulo]
⏰ Horário de Chegada: [hora_inicio]
⏰ Horário Previsto de Encerramento: [hora_fim]

Presença obrigatória de todos os demolays ativos.

Para quaisquer dúvidas, estamos à disposição! Fiquem todos com o Pai Celestial! 🔺⚔️`,o=[{key:`titulo`,label:`Título / pauta`},{key:`descricao`,label:`Descrição`},{key:`data`,label:`Data (dd/mm/aaaa)`},{key:`dia_semana`,label:`Dia da semana`},{key:`dia`,label:`Dia`},{key:`mes`,label:`Mês por extenso`},{key:`ano`,label:`Ano`},{key:`local`,label:`Local`},{key:`endereco`,label:`Endereço`},{key:`local_completo`,label:`Local + endereço`},{key:`traje`,label:`Traje`},{key:`hora_inicio`,label:`Hora de início`},{key:`hora_fim`,label:`Hora de término`},{key:`capitulo`,label:`Nome do capítulo`}];function s(n,a){let o=new Date(n.start_at),s=n.end_at?new Date(n.end_at):null,c=(n.location??``).trim(),l=(n.address??``).trim();return{titulo:n.title,descricao:(n.description??``).trim(),data:r(o),dia_semana:t[o.getDay()],dia:String(o.getDate()),mes:e[o.getMonth()],ano:String(o.getFullYear()),local:c||`A definir`,endereco:l||`A definir`,local_completo:[c,l].filter(Boolean).join(` — `)||`A definir`,traje:(n.dress_code??``).trim()||`A definir`,hora_inicio:i(o),hora_fim:s?i(s):`A definir`,capitulo:(a?.chapterName??``).trim()}}function c(e,t){let n=e.split(`
`),r=[];for(let e of n){let n=[...e.matchAll(/\[([a-z_]+)\]/gi)].map(e=>e[1].toLowerCase()),i=e.replace(/\[([a-z_]+)\]/gi,(e,n)=>{let r=t[n.toLowerCase()];return r===void 0?e:r});n.length>0&&e.replace(/\[[a-z_]+\]/gi,``).trim()===``&&i.trim()===``||r.push(i)}return r.join(`
`).replace(/\n{3,}/g,`

`).trim()}function l(e,t){return c((t?.template??``).trim()||a,s(e,{chapterName:t?.chapterName}))}function u(){let e=new Date;e.setHours(13,30,0,0);let t=new Date(e);return t.setHours(17,0,0,0),{title:`Sessão Ordinária do Grau DeMolay`,description:`Traga seu manual e chegue com 15 minutos de antecedência.`,start_at:e.toISOString(),end_at:t.toISOString(),location:`Loja Exemplo`,address:`Rua das Acácias, 100 — Centro`,dress_code:`Traje social completo`}}export{s as a,u as i,a as n,c as o,l as r,o as t};