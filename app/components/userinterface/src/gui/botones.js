createNameSpace("realityEditor.gui.botones");

realityEditor.gui.botones.onload = function () {
	realityEditor.gui.botones.pocketInit();
};

window.onload = realityEditor.gui.botones.onload;

var seleccionado;

(function(exports) {
    var buttonImages = [];
	var bigPocketImages = [];
    function pocketInit() {
        realityEditor.gui.buttons.preload(buttonImages,
            'png/intOneSelect.png', 'png/intTwoSelect.png'
        );

        pocket = document.querySelector('.pocket');
     
        Boton = document.getElementById('guiButtonImage');
		
         Boton.addEventListener('pointerdown', function() {
			Boton.src = buttonImages[1].src;
        });

        Boton.addEventListener('pointerup', function() {
            toggleShown();
        }); 
		
    }

    function toggleShown() {
        if (pocketShown()) {
            pocketHide();
			Boton.src = buttonImages[0].src;
			seleccionado=1;
			console.log("Seleccionado boton: "+seleccionado);
        } else {
            pocketShow();
			seleccionado=2;
			console.log("Seleccionado boton: "+seleccionado);
        }
    }

    function pocketShow() {
        pocket.classList.add('pocketShown1');
    }

    function pocketHide() {
        pocket.classList.remove('pocketShown1');
    }
	
    function pocketShown() {
        return pocket.classList.contains('pocketShown1');
    }

    exports.pocketInit = pocketInit;
}(realityEditor.gui.botones));
