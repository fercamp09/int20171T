
createNameSpace("realityEditor.device");

realityEditor.device.onload = function () {
	realityEditor.gui.pocket.pocketInit();
};

window.onload = realityEditor.device.onload;
