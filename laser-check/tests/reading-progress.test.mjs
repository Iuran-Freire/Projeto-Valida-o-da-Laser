import {test} from 'node:test';
import assert from 'node:assert/strict';
import {interpretProgress,progressAt,formatElapsed,createProgressLine,stepSegment,READ_STEPS} from '../frontend/src/reading-progress.mjs';

const step=text=>interpretProgress(text)?.step;

test('cada mensagem do app cai na etapa certa (código × texto)',()=>{
 for(const text of ['Lendo QR Code / Data Matrix…','Lendo QR e código de barras da etiqueta…','Lendo o 2D da bateria…','Lendo o Code 93 da etiqueta…','Lendo o Data Matrix Frecom…','Lendo o Data Matrix OPPO…','Lendo o código de barras Frecom…','M09031D · tentando outro contraste para o código 2D…'])
  assert.equal(step(text),'code',text);
 for(const text of ['Localizando e reconhecendo a linha da série…','Lendo a data e a linha pontilhada da bateria…','Lendo a série impressa abaixo do 2D…','Lendo o SN impresso na gravação…','Lendo o código impresso abaixo das barras…','Lendo o texto EAY abaixo do código de barras…','Lendo o texto abaixo do Code 93…','Preparando leitor principal da tampografia…','Lendo a linha da série · 1 de 2…','Leitura detalhada · conferindo I/1 e 5/S · 5 de 6 · ampliada…','Leitor alternativo · reconhecendo o texto impresso · 2 de 3…'])
  assert.equal(step(text),'text',text);
 for(const text of ['Foto recebida. Abrindo imagem…','Foto carregada. Iniciando leitura…'])assert.equal(step(text),'photo',text);
 // Before, "Data Matrix" was taken as text reading because of the word "data".
 assert.equal(step('Lendo QR Code / Data Matrix…'),'code');
});

test('recuperações aparecem como andamento, sem soar como erro',()=>{
 const recoveries=['Leitor alternativo · memória insuficiente · analisando a mesma foto…','Leitor alternativo · o leitor demorou a responder · analisando a mesma foto…','Leitor alternativo · falha ao carregar o leitor · analisando a mesma foto…','Leitor alternativo · pouca memória · nova tentativa com imagem menor (640 px)…','Leitor principal · pouca memória · tentando de novo com imagem menor…','Falha ao carregar o leitor · tentando novamente…','Leitor alternativo · baixa confiança ou leituras inconsistentes · analisando a mesma foto…'];
 for(const text of recoveries){
  const info=interpretProgress(text);
  assert.equal(info.step,'text',text);
  assert.doesNotMatch(info.detail,/falha|erro|insuficiente|demorou|baixa confiança/i,text);
 }
});

test('primeira leitura avisa do download e avança devagar',()=>{
 const info=interpretProgress('Preparando leitor principal · na primeira vez o download pode levar alguns minutos…');
 assert.equal(info.slow,true);assert.match(info.detail,/alguns minutos/);
 assert.ok(info.tau>=30);
});

test('"k de n" divide a parte da linha em fatias iguais',()=>{
 const first=interpretProgress('Lendo a linha da série · 1 de 2…'),second=interpretProgress('Lendo a linha da série · 2 de 2…');
 assert.ok(first.from<first.to&&first.to<=second.from+1e-9&&second.to<=1);
 assert.match(second.detail,/2 de 2/);
});

test('mensagens que não são andamento não mexem no painel',()=>{
 for(const text of ['','Código não encontrado. Aproxime a câmera ou use um leitor USB.','Selecione o turno da inspeção.'])
  assert.equal(interpretProgress(text),null,text);
});

test('linha se aproxima do fim da etapa sem alcançá-lo e nunca volta',()=>{
 const segment={from:.3,to:.55,tau:8};
 assert.equal(progressAt(segment,0),.3);
 assert.ok(progressAt(segment,8000)>.4&&progressAt(segment,600000)<=.55);
 let now=0;const line=createProgressLine(()=>now);
 line.start();line.enter(stepSegment('code'));now=5000;
 const afterCode=line.value();assert.ok(afterCode>.12&&afterCode<.3);
 // A later message with an earlier position cannot move the line back.
 line.enter({...stepSegment('photo')});assert.ok(line.value()>=afterCode);
 line.enter(interpretProgress('Lendo a linha da série · 2 de 2…'));now=6000;
 assert.ok(line.value()>=.75);assert.equal(line.elapsed(),6000);
 line.stop();assert.equal(line.running(),false);
});

test('tempo decorrido em minutos e segundos',()=>{
 assert.equal(formatElapsed(0),'0:00');assert.equal(formatElapsed(7400),'0:07');assert.equal(formatElapsed(83000),'1:23');
 assert.deepEqual(READ_STEPS,['photo','code','text','review']);
});
