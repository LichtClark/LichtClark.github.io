setTimeout(function() {
	document.write("<html><head><title>test</title><div>kekw!</div></head><body></body></html>");
	document.close();
	<!--console.log("payload working yey");!-->
	history.pushState(null, "Important Alert!", "/test.html");
}, 1);
