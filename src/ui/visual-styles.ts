// Use the editor's theme tokens so high-contrast themes retain their own palette.
export const visualStyles=String.raw`
:root{--rc-border:var(--vscode-contrastBorder,var(--vscode-widget-border,var(--vscode-panel-border,#666)));--rc-muted:var(--vscode-descriptionForeground,var(--vscode-foreground,#ccc))}
button{min-height:32px}button.text-button{min-height:28px}.muted,small,.mission-meta,.mission-progress span{opacity:1;color:var(--rc-muted)}
button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--vscode-focusBorder,#007acc);outline-offset:3px}
.tabs button[aria-selected=true]{font-weight:650;border-bottom-width:3px}.tabs button:hover{background:var(--vscode-list-hoverBackground)}
section,.task-card,.account-card{border-color:var(--rc-border)}section>h2{font-size:1.15em;line-height:1.5;margin-bottom:14px}
.form-grid{gap:16px}.form-grid label{display:flex;flex-direction:column;gap:7px;font-weight:500}.form-grid label.check-row{flex-direction:row;align-items:center}
.form-grid input:not([type=checkbox]),.form-grid select,.form-grid textarea{width:100%;max-width:100%;font-weight:400}.config-save-bar{border-top:1px solid var(--rc-border);padding-top:14px;margin-top:14px;gap:12px}
.primary-manager,.account-card.is-primary{border:2px solid var(--vscode-focusBorder,#007acc)}.primary-badge{font-weight:650;padding:4px 9px}
.owner-callout,.decision-item{border-left-width:4px}.status-pill{border:1px solid var(--rc-border);font-weight:600;white-space:nowrap}
.status-pill[data-status=running]::before{content:'▶ ';}.status-pill[data-status=waiting_owner]::before{content:'? ';}.status-pill[data-status=completed]::before{content:'✓ ';}
.runtime-strip{gap:9px 14px;line-height:1.6;padding:10px 16px;border-block:1px solid var(--rc-border);background:var(--vscode-list-hoverBackground)}
.console-composer{border:1px solid var(--rc-border);border-radius:6px}.console-composer:focus-within{border-color:var(--vscode-focusBorder,#007acc)}#console-input{font-size:1em;line-height:1.65;min-height:82px}
.console-footnote,.composer-help{color:var(--rc-muted);line-height:1.5}.session-item[aria-pressed=true]{border-left:3px solid var(--vscode-focusBorder,#007acc);font-weight:600}
.table-wrap{border:1px solid var(--rc-border);border-radius:5px}th{color:var(--vscode-foreground);background:var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-editor-background));font-size:.95em}td,th{padding:12px;line-height:1.6}td button{margin:3px}
summary{padding:6px 0;line-height:1.5}.layout-menu>summary{padding:4px 12px}input[type=checkbox],input[type=radio]{accent-color:var(--vscode-focusBorder,#007acc)}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
@media(max-width:700px){.toolbar-actions{width:100%;gap:6px}.toolbar-actions>.primary{flex:1}.brand-subtitle{font-size:.9em}.workspace-label{display:none}.tabs button{padding:9px 10px}td,th{padding:9px}.form-grid{gap:12px}}
`;
