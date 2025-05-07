// 为browser环境提供Node.js兼容性
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  window.process = {
    browser: true,
    env: {},
    version: '',
    nextTick: function(fn) { setTimeout(fn, 0); }
  };
}

export default {}; 