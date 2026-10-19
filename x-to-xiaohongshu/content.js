(() => {
  const BUTTON = 'xhs-draft-button';
  function postInfo(article) {
    const links = [...article.querySelectorAll('a[href*="/status/"]')];
    const status = links.find(a => /\/(status)\/\d+/.test(a.getAttribute('href') || ''));
    const href = status?.href || location.href;
    const text = [...article.querySelectorAll('[data-testid="tweetText"]')].map(e => e.innerText).join('\n\n');
    const author = article.querySelector('[data-testid="User-Name"]')?.innerText || '';
    return { url: href, text, author, capturedAt: new Date().toISOString() };
  }
  function addButtons() {
    document.querySelectorAll('article[data-testid="tweet"]').forEach(article => {
      if (article.querySelector('.' + BUTTON)) return;
      const button = document.createElement('button');
      button.className = BUTTON;
      button.type = 'button';
      button.textContent = '制作小红书草稿';
      button.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        button.disabled = true; button.textContent = '正在截图…';
        try {
          article.scrollIntoView({block: 'center', behavior: 'instant'});
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const rect = article.getBoundingClientRect();
          const crop = {x: Math.max(0,rect.left),y: Math.max(0,rect.top),width: Math.min(innerWidth,rect.right)-Math.max(0,rect.left),height: Math.min(innerHeight,rect.bottom)-Math.max(0,rect.top)};
          if (crop.width < 20 || crop.height < 20) throw new Error('帖子没有进入可见区域');
          button.style.visibility = 'hidden';
          await new Promise(resolve => requestAnimationFrame(resolve));
          const result = await chrome.runtime.sendMessage({type:'CAPTURE_POST', post:postInfo(article), crop, viewport:{width:innerWidth,height:innerHeight}, clipped:rect.top < 0 || rect.bottom > innerHeight});
          if (!result?.ok) throw new Error(result?.error || '截图失败');
        } catch(error) { alert('制作草稿失败：' + error.message); }
        finally {button.style.visibility='';button.disabled=false;button.textContent='制作小红书草稿';}
      });
      const actions = article.querySelector('[role="group"]');
      (actions || article).append(button);
    });
  }
  let timer;
  new MutationObserver(() => {clearTimeout(timer);timer=setTimeout(addButtons,150)}).observe(document.documentElement,{childList:true,subtree:true});
  addButtons();
})();
