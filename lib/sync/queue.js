var queue = [];
var timer = null;

module.exports.interval = 10 * 1000;

module.exports.add = function(task) {
  queue.push(task);
  !timer && start();
};


module.exports.del = function(task) {
  var idx = queue.indexOf(task);
  if (~idx) {
    queue.splice(idx, 1);
  }
};



function start() {
  timer = null;
  if (queue.length) {
    queue.shift()();
    if(queue.length) {
      timer = setTimeout(start, module.exports.interval);
    }
  }
}

