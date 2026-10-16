import {translator,type Language} from '../core/i18n';
import {escapeHtml as h} from './html';
export function voiceInput(language:Language):string{
 const t=translator(language),tr=(s:string)=>h(t(s));
 const shortcut=process.platform==='win32'?'Win+H':process.platform==='darwin'?'Fn / Globe ×2':t('Your desktop dictation shortcut');
 return `<details id="voice-panel" data-detail="voice-input"><summary>${tr('Voice input')}</summary><p>${tr('Dictation inserts text into the draft. Review it before sending; audio is not stored by RelayCrew.')}</p><p>${tr('System dictation')}: <kbd>${h(shortcut)}</kbd> · ${tr('Focus the prompt first.')}</p><label class="check-row"><input id="voice-opt-in" type="checkbox">${tr('Allow browser speech service when available (audio may be processed remotely).')}</label><button type="button" id="voice-toggle" aria-pressed="false" data-start="${tr('Start dictation')}" data-stop="${tr('Stop dictation')}" data-unavailable="${tr('Browser dictation is unavailable here. The prompt is focused; use system dictation.') }" data-failed="${tr('Dictation could not start. Check microphone permission or use system dictation.')}">${tr('Start dictation')}</button><p id="voice-status" role="status" aria-live="polite"></p></details>`;
}
export const voiceClient=String.raw`
let recognition=null;const voiceToggle=document.getElementById('voice-toggle'),voiceStatus=document.getElementById('voice-status');
function stopDictation(){recognition?.abort();recognition=null;voiceToggle.setAttribute('aria-pressed','false');voiceToggle.textContent=voiceToggle.dataset.start;}
voiceToggle.addEventListener('click',()=>{
 if(recognition){stopDictation();return;}consoleInput.focus();const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech||!document.getElementById('voice-opt-in').checked){voiceStatus.textContent=voiceToggle.dataset.unavailable;return;}
 try{const engine=new Speech();recognition=engine;engine.lang=document.documentElement.lang==='vi'?'vi-VN':'en-US';engine.continuous=true;engine.interimResults=true;
 engine.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const value=e.results[i][0].transcript;if(e.results[i].isFinal){if(consolePending)continue;const room=consoleInput.maxLength-consoleInput.value.length;if(room<=0)continue;consoleInput.setRangeText((value+' ').slice(0,room),consoleInput.selectionStart,consoleInput.selectionEnd,'end');consoleInput.dispatchEvent(new Event('input',{bubbles:true}));}else interim+=value;}voiceStatus.textContent=interim;};
 engine.onerror=()=>{voiceStatus.textContent=voiceToggle.dataset.failed;stopDictation();};engine.onend=()=>{if(recognition===engine){recognition=null;voiceToggle.setAttribute('aria-pressed','false');voiceToggle.textContent=voiceToggle.dataset.start;}};engine.start();voiceToggle.setAttribute('aria-pressed','true');voiceToggle.textContent=voiceToggle.dataset.stop;
 }catch{voiceStatus.textContent=voiceToggle.dataset.failed;stopDictation();}
});
window.addEventListener('blur',stopDictation);window.addEventListener('pagehide',stopDictation);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&recognition){e.preventDefault();stopDictation();}});document.addEventListener('click',e=>{if(e.target.closest('[data-tab]')?.dataset.tab!=='console'&&e.target.closest('[data-tab]'))stopDictation();});document.getElementById('console-form').addEventListener('submit',stopDictation);
`;
