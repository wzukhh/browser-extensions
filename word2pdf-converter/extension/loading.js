var retries = 0;
var maxRetries = 30;

function pollUrl() {
  try {
    chrome.runtime.sendMessage({type: 'get-server-url'}, function(response) {
      if (response && response.url) {
        window.location.href = response.url;
      } else if (response && response.office && !response.office.available) {
        document.getElementById('hint').textContent = '⚠️ 未检测到 Office 或 WPS';
      } else if (retries < maxRetries) {
        retries++;
        var dots = Array(retries % 4).fill('.').join('');
        document.getElementById('hint').textContent = '启动中' + dots;
        setTimeout(pollUrl, 400);
      } else {
        document.getElementById('hint').textContent = '⚠️ 启动超时，请重试';
      }
    });
  } catch(e) {
    document.getElementById('hint').textContent = '⚠️ 连接错误';
  }
}

pollUrl();
