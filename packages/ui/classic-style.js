/** Styles are shipped with the reusable UI package; no document-global theme reset. */
export const CLASSIC_MENU_CSS = `
#arena #menu-layer.classic-ui{position:absolute!important;width:320px!important;height:200px!important;min-height:200px!important;padding:0!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%) scale(var(--ui-scale))!important;transform-origin:center!important;background:#282f33!important;border:1px solid #d7dc37!important;box-shadow:none!important;overflow:hidden!important;display:block!important;color:#e7e84b;font:8px/10px monospace!important;isolation:isolate}
#arena #menu-layer.classic-ui[hidden]{display:none!important}
.classic-backdrop{display:none;pointer-events:none}
#arena .classic-ui .classic-backdrop{display:block;position:absolute;inset:0;width:320px;height:200px;z-index:-1;image-rendering:pixelated}
#arena #menu-layer.classic-ui *{border-radius:0!important;box-shadow:none!important;letter-spacing:0!important;text-transform:none;box-sizing:border-box}
#arena #menu-layer.classic-ui #menu-header{position:absolute!important;left:7px!important;top:0!important;width:306px!important;height:38px!important;min-height:38px!important;border:0!important;border-bottom:1px solid #d7dc37!important;padding:0!important;display:block!important}
#arena #menu-layer.classic-ui #logo{position:absolute!important;left:12px!important;top:5px!important;width:122px!important;height:27px!important;margin:0!important;image-rendering:pixelated}
#arena #menu-layer.classic-ui #header-note{position:absolute;left:141px;top:9px;font-size:8px!important;line-height:12px!important;max-width:none!important;text-align:left;color:#dfe54c}
#arena #menu-layer.classic-ui #renderer-name,#arena #menu-layer.classic-ui footer{display:none!important}
#arena #menu-layer.classic-ui #menu-heading{position:absolute;left:9px;right:8px;top:44px;height:8px!important;min-height:8px!important;padding:0!important;margin:0!important;line-height:8px!important;color:#f1c94a;white-space:nowrap;overflow:hidden}
#arena #menu-layer.classic-ui #menu-content{position:absolute;left:8px;top:58px;width:304px;height:135px;min-height:0!important;padding:0!important;margin:0!important;overflow:auto;scrollbar-width:thin;scrollbar-color:#a7ada0 #303940}
#arena #menu-layer.classic-ui canvas{image-rendering:pixelated;image-rendering:crisp-edges}
#arena #menu-layer.classic-ui .classic-ink{display:inline-block;position:relative;vertical-align:top;line-height:8px!important;height:8px;max-width:100%;overflow:hidden;white-space:pre;color:inherit}
#arena #menu-layer.classic-ui .classic-ink canvas{display:block!important;max-width:none!important;vertical-align:top}
#arena #menu-layer.classic-ui .classic-semantic{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:pre!important;border:0!important}
#arena #menu-layer.classic-ui :is(button,input,select,textarea,summary){font:8px/10px monospace!important;color:inherit;border-radius:0!important;min-width:0;outline-offset:-1px!important}
#arena #menu-layer.classic-ui :is(button,summary):focus,#arena #menu-layer.classic-ui :is(button,summary):hover{outline:1px solid #42d4d1!important;background:transparent!important;color:#bb9428}
#arena #menu-layer.classic-ui button:disabled{color:#777f66;opacity:.6;outline:none!important}
#arena #menu-layer.classic-ui button:before{content:none!important}
#arena #menu-layer.classic-ui button{border:0;background:transparent;text-align:left;white-space:nowrap}
#arena #menu-layer.classic-ui .menu-item{width:100%;height:12px!important;min-height:12px!important;padding:2px 1px!important;margin:0;line-height:8px!important}
#arena #menu-layer.classic-ui .main-menu{position:static!important;display:flex;flex-direction:column;width:170px!important;padding:0!important;margin:7px 0 0 39px!important;gap:0!important}
#arena #menu-layer.classic-ui[data-view=main] #menu-content{left:0;top:58px;width:320px;height:141px;overflow:hidden}
#arena #menu-layer.classic-ui[data-view=main] .main-menu{position:absolute!important;left:48px!important;top:20px!important;width:120px!important;margin:0!important}
#arena #menu-layer.classic-ui[data-view=main] [data-action=quit]{margin-top:24px!important}
#arena #menu-layer.classic-ui .classic-extensions{display:none!important}
#arena #menu-layer.classic-ui .small-button{height:13px!important;min-height:13px!important;padding:2px 4px!important;font-size:8px!important;line-height:8px!important;border:1px solid #737f6c!important;background:#222c30b3;color:#e8e949}
#arena #menu-layer.classic-ui .small-button.primary{border-color:#c5c642!important;color:#f6ef59}
#arena #menu-layer.classic-ui .buttons{display:flex;flex-wrap:wrap;gap:3px!important;margin:5px 0 0!important;padding:1px 0!important;align-items:center}
#arena #menu-layer.classic-ui #menu-content>.buttons:last-child{position:sticky;bottom:0;background:#252f34;z-index:2}
#arena #menu-layer.classic-ui .toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:3px!important;padding:0!important;margin:0 0 4px!important;font-size:8px!important;line-height:10px!important}
#arena #menu-layer.classic-ui .toolbar label{display:flex;align-items:center;gap:3px}
#arena #menu-layer.classic-ui :is(p,.hint,.empty,.replay-info){font:8px/10px monospace!important;letter-spacing:0!important;margin:3px 0!important;line-height:10px!important;color:#b6b9a1}
#arena #menu-layer.classic-ui .hint{font-size:8px!important}
#arena #menu-layer.classic-ui .empty{padding:18px 8px!important;text-align:left}
#arena #menu-layer.classic-ui .grid2,#arena #menu-layer.classic-ui .help-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
#arena #menu-layer.classic-ui :is(h2,h3,h4){margin:0 0 4px!important;font:8px/10px monospace!important;color:#e8be48}
#arena #menu-layer.classic-ui :is(.form-grid,.setup-top){display:grid;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:4px 8px!important}
#arena #menu-layer.classic-ui .field{display:flex;flex-direction:column;gap:2px!important;font-size:8px!important;line-height:8px!important;min-width:0;color:#57d4d0}
#arena #menu-layer.classic-ui .field.full{grid-column:1/-1}
#arena #menu-layer.classic-ui :is(select,input,textarea){height:14px!important;min-height:14px!important;width:100%;padding:2px 3px!important;border:1px solid #828a76!important;background:#18272e!important;color:#e8e94d!important;appearance:none;box-shadow:inset 1px 1px #111!important}
#arena #menu-layer.classic-ui :is(input,textarea){user-select:text;-webkit-user-select:text}
#arena #menu-layer.classic-ui :is(input,select,textarea):focus{outline:1px solid #42d4d1!important}
#arena #menu-layer.classic-ui select{min-width:38px!important;max-width:100%!important}
#arena #menu-layer.classic-ui input[type=color]{height:15px!important;min-height:15px!important;padding:1px!important}
#arena #menu-layer.classic-ui .classic-native{position:relative;display:inline-block;min-width:0;max-width:100%;width:100%;height:14px;vertical-align:middle}
#arena #menu-layer.classic-ui .classic-native :is(input,select,textarea){color:transparent!important;caret-color:transparent}
#arena #menu-layer.classic-ui .classic-native select option{color:#e8e94d!important;background:#1b2b30}
#arena #menu-layer.classic-ui .classic-value{position:absolute;top:0;left:0;pointer-events:none;width:100%;height:100%;image-rendering:pixelated}
#arena #menu-layer.classic-ui .toolbar .classic-native{width:83px}
#arena #menu-layer.classic-ui .check{display:flex;gap:3px!important;align-items:center;min-height:11px!important;font-size:8px!important;line-height:8px!important}
#arena #menu-layer.classic-ui input[type=checkbox]{appearance:none!important;flex:none;width:7px!important;height:7px!important;min-height:7px!important;padding:0!important;border:1px solid #93996b!important;background:transparent!important}
#arena #menu-layer.classic-ui input[type=checkbox]:checked{background:#e1e549!important;box-shadow:inset 0 0 0 1px #364138!important}
#arena #menu-layer.classic-ui input[type=range]{appearance:none;height:11px!important;min-height:11px!important;padding:0!important;background:#6f797d!important;border:1px solid #9ea8a8!important}
#arena #menu-layer.classic-ui input[type=range]::-webkit-slider-thumb{appearance:none;width:7px;height:9px;background:#c6cdd0;border:1px solid #46545b}
#arena #menu-layer.classic-ui input[type=range]::-moz-range-thumb{width:7px;height:9px;background:#c6cdd0;border:1px solid #46545b;border-radius:0}
#arena #menu-layer.classic-ui .check-grid{display:grid;grid-template-columns:repeat(4,1fr)!important;gap:1px!important}
#arena #menu-layer.classic-ui .hill-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:1px!important}
#arena #menu-layer.classic-ui .hill-button{padding:2px 1px!important;min-height:12px!important;height:12px;gap:0!important;display:flex;flex-direction:column;border:0!important;font-size:8px!important;overflow:hidden}
#arena #menu-layer.classic-ui .hill-button>span:first-child{height:8px;white-space:nowrap}
#arena #menu-layer.classic-ui .hill-button .pb{display:none}
#arena #menu-layer.classic-ui .hill-sub{display:none!important;font-size:8px!important;display:flex;width:100%;justify-content:space-between;line-height:8px!important;color:#53d3ce}
#arena #menu-layer.classic-ui .hill-k{font-size:8px!important;line-height:8px!important}
#arena #menu-layer.classic-ui .hill-sub>span:first-child{display:none}
#arena #menu-layer.classic-ui .player-editor{display:grid;grid-template-columns:98px 1fr!important;gap:8px!important}
#arena #menu-layer.classic-ui .player-list{max-height:86px!important;border:1px solid #69766a;overflow:auto}
#arena #menu-layer.classic-ui .player-row{display:flex;align-items:center;width:100%;min-height:12px!important;height:12px;padding:2px!important;gap:3px;font-size:8px!important}
#arena #menu-layer.classic-ui .swatch{height:6px;width:6px;min-width:6px;border:0}
#arena #menu-layer.classic-ui .player-row.active{color:#53d3ce}
#arena #menu-layer.classic-ui .table-wrap{max-height:98px!important;overflow:auto;border:0!important;margin:0!important;scrollbar-width:thin}
#arena #menu-layer.classic-ui table{border-collapse:collapse;width:100%;font:8px/10px monospace!important;table-layout:auto}
#arena #menu-layer.classic-ui :is(td,th){padding:2px 2px!important;border:0!important;height:12px;white-space:nowrap;vertical-align:top;font-size:8px!important;line-height:8px!important}
#arena #menu-layer.classic-ui th{color:#54d9d0;background:#273237;position:sticky;top:0;text-align:left;z-index:1}
#arena #menu-layer.classic-ui .num{text-align:right;font-variant-numeric:tabular-nums}
#arena #menu-layer.classic-ui tr.you{color:#55d6d0;background:transparent!important}
#arena #menu-layer.classic-ui .table-link{height:8px!important;padding:0!important}
#arena #menu-layer.classic-ui .classic-records{position:absolute;left:39px;top:5px;margin:0!important;width:250px}
#arena #menu-layer.classic-ui .classic-record{display:grid;grid-template-columns:70px 36px 1fr!important;width:250px!important;min-height:10px!important;height:10px;padding:1px 1px!important;color:#52d2cf;line-height:8px!important}
#arena #menu-layer.classic-ui .record-page{position:fixed!important;top:44px!important;right:22px!important;margin:0!important;line-height:8px!important;color:#eec748}
#arena #menu-layer.classic-ui .classic-record-nav{position:absolute;left:39px;top:100px;display:grid;grid-template-columns:142px 1fr!important;width:252px;margin:0!important;gap:2px 0}
#arena #menu-layer.classic-ui .classic-record-nav [data-action=main]{grid-column:1/-1;margin-top:0!important}
#arena #menu-layer.classic-ui .classic-record-nav .menu-item{width:auto}
#arena #menu-layer.classic-ui .classic-record-tools{display:none!important}
#arena #menu-layer.classic-ui .record-extensions{font-size:8px!important}
#arena #menu-layer.classic-ui .sound-setup{width:210px;max-width:none!important;margin:4px 0 0 39px!important}
#arena #menu-layer.classic-ui .sound-setup .field{margin:8px 0}
#arena #menu-layer.classic-ui .sound-setup .buttons{margin-top:18px!important}
#arena #menu-layer.classic-ui .tour-events{max-height:58px!important;margin:3px 0!important;overflow:auto;border:1px solid #6d795f}
#arena #menu-layer.classic-ui .tour-event{display:flex;flex-wrap:nowrap!important;gap:2px;min-height:14px;padding:1px!important;font-size:8px!important}
#arena #menu-layer.classic-ui .tour-event strong{flex:1;flex-basis:auto!important;font-size:8px;white-space:nowrap!important;overflow:hidden}
#arena #menu-layer.classic-ui .small-button.tiny{font-size:8px!important;padding:1px 2px!important;min-height:11px!important;height:11px!important}
#arena #menu-layer.classic-ui [data-view=tour] input{width:100%}
#arena #menu-layer.classic-ui .result-top{display:flex;flex-direction:row!important;gap:6px;align-items:start;justify-content:space-between}
#arena #menu-layer.classic-ui .jump-distance [data-pixel]{color:#eaf15b}
#arena #menu-layer.classic-ui .points-big{text-align:right!important;font-size:8px!important}
#arena #menu-layer.classic-ui .points-big small{display:block;font-size:8px!important}
#arena #menu-layer.classic-ui .judge-marks{display:flex;gap:10px;padding:5px 0!important;margin:0;justify-content:flex-start}
#arena #menu-layer.classic-ui .judge{padding:1px!important;font-size:8px!important;min-width:0;text-align:center}
#arena #menu-layer.classic-ui .judge small{display:block;font-size:8px!important;color:#55d6d0;margin-bottom:3px}
#arena #menu-layer.classic-ui .judge.dropped{color:#919475;opacity:1}
#arena #menu-layer.classic-ui .result-meta{display:grid;grid-template-columns:repeat(4,1fr)!important;gap:3px;margin:4px 0!important;font-size:8px!important}
#arena #menu-layer.classic-ui .result-meta strong{display:block;font-size:8px!important;color:#f0d652;margin-top:2px}
#arena #menu-layer.classic-ui .new-record{font-size:8px!important;margin:3px 0!important;padding:2px!important;animation:none!important;color:#57e1d6}
#arena #menu-layer.classic-ui .replay-list{position:absolute;left:39px;top:0;width:244px;height:91px;overflow:auto;scrollbar-width:thin}
#arena #menu-layer.classic-ui .replay-list .menu-item{width:242px;height:11px!important;min-height:11px!important;overflow:hidden}
#arena #menu-layer.classic-ui .replay-list-footer{position:absolute;left:39px;top:111px;width:245px;display:flex;gap:12px}
#arena #menu-layer.classic-ui .replay-list-footer .menu-item{width:auto}
#arena #menu-layer.classic-ui .replay-detail{margin:1px 0 0 39px;display:grid;grid-template-columns:60px 1fr;gap:2px;color:#e4b83e;line-height:8px}
#arena #menu-layer.classic-ui .replay-detail-actions{position:absolute;left:39px;top:69px;width:230px}
#arena #menu-layer.classic-ui .replay-detail-actions [data-action=replays]{margin-top:17px}
#arena #menu-layer.classic-ui .replay-detail-tools{display:flex;gap:4px;margin-top:5px}
#arena #menu-layer.classic-ui .classic-select-popup{position:absolute;max-height:112px;padding:2px;background:#243139;border:1px solid #62c8c7;overflow:auto;z-index:30;scrollbar-width:thin}
#arena #menu-layer.classic-ui .classic-select-popup button{display:block;width:100%;height:12px;padding:2px;overflow:hidden}
#arena #menu-layer.classic-ui .classic-select-popup [aria-selected=true]{color:#56d5d3}
#arena #menu-layer.classic-ui .classic-confirm{border:1px solid #c7ce55;background:#222f36;padding:8px;margin:10px 25px}
#arena #menu-layer.classic-ui kbd{padding:0 1px;font-size:8px!important;border:1px solid #889876}
.ski-classic-host{position:fixed;bottom:max(5px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;justify-content:center;flex-wrap:wrap;gap:5px;z-index:50;width:max-content;max-width:100vw;padding:4px;background:#101b22e8;border:1px solid #5a6c67}
.ski-classic-host[hidden]{display:none!important}
.ski-classic-host button{font:11px monospace;color:#dade77;border:1px solid #5f7473;border-radius:0;background:#1d2b31;min-width:32px;min-height:26px;padding:4px 8px}
.ski-classic-host button:focus-visible{outline:2px solid #48d6d4}
.ski-classic-host .touch-nav{display:none}
@media(pointer:coarse){.ski-classic-host .touch-nav{display:block}.ski-classic-host button{min-height:44px;min-width:44px}.ski-classic-host{width:max-content;max-width:100%;gap:3px}}

.ski-classic-host .classic-extensions{position:static;display:flex;gap:5px;flex-wrap:wrap;margin:0;padding:0}
.ski-classic-host .classic-host-navigation{display:flex;gap:4px}
.ski-classic-host .classic-record-tools{position:static;max-width:260px;margin:0;font:11px monospace}
.ski-classic-host .classic-record-tools summary{cursor:pointer;padding:6px;color:#dadd80}
.ski-classic-host .classic-record-tools[open]{position:absolute;bottom:38px;right:0;padding:10px;background:#15242b;border:1px solid #56aaa8;width:270px;max-width:90vw}
.ski-classic-host .classic-record-tools .toolbar{font-size:11px;flex-wrap:wrap}
.ski-classic-host .classic-record-tools .hint{font-size:10px;line-height:14px}
#arena #menu-layer.classic-ui .replay-list .replay-info{margin:0!important;height:11px!important;line-height:8px!important}

#arena #menu-layer.classic-ui .classic-copy{display:inline;min-width:0;max-width:100%;line-height:10px}
#arena #menu-layer.classic-ui .field>.classic-copy{display:block}
#arena #menu-layer.classic-ui [hidden]{display:none!important}
#arena #menu-layer.classic-ui .classic-tabs{display:flex;gap:6px;margin:0 0 5px}
#arena #menu-layer.classic-ui .classic-tabs button{border:0!important;padding:1px 4px!important;color:#b7c3a7}
#arena #menu-layer.classic-ui .classic-tabs [aria-selected=true]{color:#50d8d1;border-bottom:1px solid #50d8d1!important}
#arena #menu-layer.classic-ui[data-view=options] #menu-content>.hint{display:none}

#arena #menu-layer.classic-ui .classic-copy{position:relative}

#arena #menu-layer.classic-ui .classic-record:hover,#arena #menu-layer.classic-ui .classic-record:focus{color:#52d2cf!important}
#arena #menu-layer.classic-ui .classic-record>span:last-child{color:#e8e94d}
`;
