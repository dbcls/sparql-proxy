var socket = io();
socket.on('state', function(state) {
  var e = document.getElementById('status');
  e.innerHTML = state.queueLength;
});
