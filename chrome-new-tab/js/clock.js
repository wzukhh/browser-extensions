const clock = {
  timeEl: document.getElementById('time'),
  dateEl: document.getElementById('date'),
  intervalId: null,

  init() {
    this.update();
    this.intervalId = setInterval(() => this.update(), 1000);
  },

  update() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    this.timeEl.textContent = `${h}:${m}:${s}`;

    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const day = days[now.getDay()];
    this.dateEl.textContent = `${y} 年 ${mo} 月 ${d} 日 星期${day}`;
  },

  destroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  },
};
