
;(function(){
  var s = document.currentScript || (function(){ var a=document.getElementsByTagName('script'); return a[a.length-1] })();
  var cfg = (window.KAIZEN_CHATBOX || {});
  function attr(k, d){ return (cfg[k]!=null?cfg[k]:s.getAttribute('data-'+k)) || d }

  var apiBase   = attr('api',  (window.VITE_API_BASE || '').replace(/\/+$/,'') || '' );
  var chatWeb   = attr('web',  'https://chat.kaizenapps.net');
  var label     = attr('label','Ayuda');
  var theme     = attr('theme','dark');
  var z         = attr('z','2147483000');

  function getSession(key, def){ try{ return sessionStorage.getItem(key) || def }catch(_){ return def } }
  var license   = attr('license', getSession('kaizen.license',''));
  var prefix    = attr('prefix',  getSession('kaizen.prefix',''));
  var client    = attr('client',  getSession('kaizen.clientName',''));
  var report    = attr('report',  getSession('kaizen.reportCode',''));

  var css = document.createElement('style');
  css.textContent = '.kz-fab{position:fixed;right:18px;bottom:18px;display:inline-flex;gap:8px;align-items:center;'+
    'height:52px;border-radius:26px;padding:0 14px;border:0;cursor:pointer;'+
    'box-shadow:0 12px 28px rgba(0,0,0,.25);z-index:'+z+';font:600 14px/1.1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;'+
    'background:'+(theme==='light'?'#0ea5e9':'#e11d48')+';color:#fff}'+
    '.kz-fab svg{width:20px;height:20px;fill:currentColor}'+
    '.kz-panel{position:fixed;right:18px;bottom:82px;width:380px;height:560px;max-width:calc(100vw - 24px);'+
    'max-height:calc(100vh - 110px);border-radius:12px;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.35);display:none;z-index:'+z+'}'+
    '.kz-panel iframe{width:100%;height:100%;border:0;background:#0b0b0b}'+
    '@media(max-width:520px){.kz-panel{right:0;bottom:0;width:100vw;height:100vh;border-radius:0}}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.className = 'kz-fab';
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3c-5 0-9 3.6-9 8 0 2.1.9 4 2.5 5.4L5 21l4-1.7c.9.3 1.9.4 3 .4 5 0 9-3.6 9-8s-4-8-9-8z"/></svg><span>'+label+'</span>';
  document.body.appendChild(btn);

  var panel = document.createElement('div');
  panel.className = 'kz-panel';
  var iframe = document.createElement('iframe');
  iframe.allow = 'clipboard-read; clipboard-write; microphone; camera';
  panel.appendChild(iframe);
  document.body.appendChild(panel);

  var open = false;
  btn.addEventListener('click', async function(){
    open = !open;
    panel.style.display = open ? 'block':'none';
    if (!open) return;
    try {
      var body = JSON.stringify({ license: license });
      var base = apiBase || (window.VITE_API_BASE || '');
      var url  = (base ? base : '') + '/auth/assist/thread';
      var r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body });
      if (!r.ok) throw new Error('thread-resolve-failed:'+r.status);
      var data = await r.json();
      var q = new URLSearchParams({
        thread: data.threadId || '',
        assistant: data.assistantId || '',
        prefix: data.prefix || '',
        client: data.clientName || '',
        report: report || '',
        site: 'https://kaizenapps.net',
        app: 'https://kaizenapps.net/app',
        mobile: 'https://kaizenapps.net/mobile'
      });
      iframe.src = chatWeb.replace(/\/+$/,'') + '/widget.html#' + q.toString();
    } catch (e) {
      iframe.srcdoc = '<div style="display:grid;place-items:center;height:100%;color:#fff;font:14px system-ui">'+
        '<div>Chat no disponible<br/>'+String(e)+'</div></div>';
    }
  });
})();
