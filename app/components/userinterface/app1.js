/// <reference types="@argonjs/argon" />
/// <reference types="three" />
/// <reference types="dat-gui" />
/// <reference types="stats" />

globalConnect.connected = false;
// For clicking the markers
function click(e){
	 
    if (!globalConnect.connected){ 
		console.log(e.target);
		// Identify the object and the node.
		var id = e.target.id.split("-");
		globalConnect.objectA = id[0];
		globalConnect.nodeA = id[1];
		// Obtain the points of the click
		var rect = e.target.getBoundingClientRect();
		globalConnect.startPoint[1] = rect.top + rect.height/2;
		globalConnect.startPoint[0] = rect.left + rect.width/2;
		console.log( globalConnect.startPoint);
		globalConnect.connected = true;
		// Get frame window
		var frameWindow = document.getElementById('iframe-'+e.target.id).contentWindow;
		// Send a message to the frame's window
		var msg = { uiActionFeedback: 0};
		frameWindow.postMessage(msg, '*');
		
	} else {
		if (e.target.id == globalConnect.objectA+'-'+globalConnect.nodeA){ 
			reset();
			return;
		}
		// Identify the object and the node.
		var id = e.target.id.split("-");
		globalConnect.objectB = id[0];
		globalConnect.nodeB = id[1];
			
		// Obtain the points of the click
		var rect = e.target.getBoundingClientRect();
		globalConnect.endPoint[1] = rect.top + rect.height/2;
		globalConnect.endPoint[0] = rect.left + rect.width/2;
		// Draw the connection
		// drawDotLine(globalCanvas.context, globalConnect.startPoint, globalConnect.endPoint, 0, 0);
		makeConnectionOnServer(globalConnect.objectA, globalConnect.objectB, globalConnect.nodeA,globalConnect.nodeB );
		reset();
	}
}
// For resetting the state after connecting a line
function reset (){
    //globalConnect.fromNode.style.backgroundColor = "transparent";
    // Restore color of red markers
	// Get frame window
	var frameWindow = document.getElementById('iframe-'+globalConnect.objectA+'-'+globalConnect.nodeA).contentWindow;
	// Send a message to the frame's window
	var msg = { uiActionFeedback: 1};
	frameWindow.postMessage(msg, '*');
	       	
    globalConnect.  nodeA = "";
    globalConnect.nodeB = "";    
    globalConnect.click = false;
    globalConnect.connected = false;
    
}

// Get the window positions of two html elements
function getPointsFromNodes(nodeA, nodeB){
    var connect = {
        startPoint: [0,0],
        endPoint: [0,0],
    }
    var rectA = nodeA.getBoundingClientRect();
    connect.startPoint[1] = rectA.top + rectA.height/2;
    connect.startPoint[0] = rectA.left + rectA.width/2;
    var rectB = nodeB.getBoundingClientRect();
    connect.endPoint[1] = rectB.top + rectB.height/2;
    connect.endPoint[0] = rectB.left + rectB.width/2;
    return connect;
}

// Used for the event listener of "touchstart" on the markers overlay
function touchStart (e) {
    // Set to true when the first marker is touched
    globalConnect.click = true;
   
    // globalConnect.connected = false;
    // globalConnect.nodeA = e.target;
    
    // Identify the object and the node just clicked. 
    // NodeID: "objectA-nodeA"
    var id = e.target.id.split("-");
    globalConnect.objectA = id[0];
    globalConnect.nodeA = id[1];
    
    // Obtain the points of the marker which was clicked
    var rect = e.target.getBoundingClientRect();
    globalConnect.startPoint[1] = rect.top + rect.height/2;
    globalConnect.startPoint[0] = rect.left + rect.width/2;    
}

// For resetting the state after connecting a line
/*function reset (){
    // Reset the globalConnect variables used when connecting
    globalConnect.nodeA = "";
    globalConnect.nodeB = "";    
    globalConnect.click = false;
    //globalConnect.connected = true;
    
    
}*/
    
// Function used in the event listener of "mousemove", for 
// getting the point of the mouse. 
// That info is later used in the update for drawing a line 
function mantainLine(event){
    globalConnect.endPoint[0] = event.clientX;
    globalConnect.endPoint[1] = event.clientY;
}

// Used for the event listener of "touchend" on the markers overlay
function touchEnd (e) {
    globalConnect.click = false;
    // globalConnect.connected = true;
    
    // Identify the object and the node just clicked.
    // NodeID: "objectB-nodeB"
    var id = e.target.id.split("-");
    globalConnect.objectB = id[0];
    globalConnect.nodeB = id[1];
        
    // Obtain the points of the node clicked.
    var rect = e.target.getBoundingClientRect();
    globalConnect.endPoint[1] = rect.top + rect.height/2;
    globalConnect.endPoint[0] = rect.left + rect.width/2;

    // Draw the line
    // drawDotLine(globalCanvas.context, globalConnect.startPoint, globalConnect.endPoint, 0, 0);
    
    // Make the connection
    makeConnectionOnServer(globalConnect.objectA, globalConnect.objectB, globalConnect.nodeA,globalConnect.nodeB );
    reset();
}

// Used for creating a marker 
function drawMarker(x, y, id, src) {
    // Create a div for positioning a div and an iframe
    var container0 = document.createElement('div');
    container0.style.height = "250px";
    container0.style.width = "250px";
    container0.style.position = "absolute";
    container0.style.left = x;
    container0.style.top = y;

    // Draw a transparent overlay   
    var overlay = document.createElement('div');
    overlay.style.position = "absolute";
    overlay.style.backgroundColor = "transparent";
    overlay.style.height = "250px";
    overlay.style.width = "250px";
    overlay.style.position = "absolute";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.id = id;

    // Create the iframe
    var iframe = document.createElement('iframe');
    //iframe.src = 'http://200.126.23.63:1337/vuforia/nodes/node/index.html';
      iframe.src = 'nodes/' + src + '/index.html';
    iframe.frameBorder = 0;
    //iframe.setAttribute("sandbox", "allow-forms allow-pointer-lock allow-same-origin allow-scripts");
    //iframe.className = 'interactive';
    iframe.style.height = "250px";
    iframe.style.width = "250px";
    iframe.id = "iframe-" + id;

    // Set the event listeners
    //overlay.addEventListener("pointerdown", touchStart);
    //overlay.addEventListener("pointerup", touchEnd);
    overlay.addEventListener("pointerup", click);
    // For showing the line while moving over a marker
    container0.addEventListener("pointermove", mantainLine);
    iframe.onload = function(){
		// Get frame window
		var frameWindow = iframe.contentWindow;
		
		// Send a message to the frame's window
		var msg = {nodeName: id};
		frameWindow.postMessage(msg, '*');
    };
    
    // Stack elements to form a marker.
    container0.appendChild(iframe);
    container0.appendChild(overlay);

    return container0;
}

// Send an http request deleting the link in the database
function deleteLinkFromObject(ip, thisObjectKey, thisKey){
    // Send http request for deleting a link in the server
}

// Delete connection lines
function deleteLines(x21, y21, x22, y22) {
    // Search in every object, using every link to verify 
    // if it crosses the line created, if it does delete the link
    for (var keysome in objects) {
        if (!objects.hasOwnProperty(keysome)) {
            continue;
        }
        var thisObject = objects[keysome];

        for (var subKeysome in thisObject.links) {
            if (!thisObject.links.hasOwnProperty(subKeysome)) {
                continue;
            }
            var l = thisObject.links[subKeysome];
            var oA = thisObject;
            var oB = objects[l.objectB];
            
            if (typeof(oA) === 'undefined' || typeof(oB) === 'undefined') {
                continue;
            }
            
            /*if (!oA.objectVisible && !oB.objectVisible) {
                continue;
            }*/

            var bA = oA.nodes[l.nodeA];
            var bB = oB.nodes[l.nodeB];
            if (typeof(bA) === 'undefined' || typeof(bB) === 'undefined') {
                continue; //should not be undefined
            }
            
        /*        
        if (checkLineCross(bA.screenX, bA.screenY, bB.screenX, bB.screenY, x21, y21, x22, y22, globalCanvas.canvas.width, globalCanvas.canvas.height)) {
                    delete thisObject.objectLinks[subKeysome];
                    cout("iam executing link deletion");
                    deleteLinkFromObject(thisObject.ip, keysome, subKeysome);
                }
            }
        }
        */
        // Get nodes window position from markers html elements
        var connect = getPointsFromNodes(bA, bB);
        
        console.log(realityEditor.gui.utilities.checkLineCross(connect.startPoint[0], connect.startPoint[1], connect.endPoint[0], connect.endPoint[1], x21, y21, x22, y22, globalCanvas.canvas.width, globalCanvas.canvas.height));
        //if (this.realityEditor.gui.utilities.checkLineCross(bA.screenX, bA.screenY, bB.screenX, bB.screenY, x21, y21, x22, y22, globalCanvas.canvas.width, globalCanvas.canvas.height)) {
        if (realityEditor.gui.utilities.checkLineCross(connect.startPoint[0], connect.startPoint[1], connect.endPoint[0], connect.endPoint[1], x21, y21, x22, y22, globalCanvas.canvas.width, globalCanvas.canvas.height)) {                
                //if (realityEditor.device.security.isLinkActionAllowed(keysome, subKeysome, "delete")) {    
                    delete thisObject.links[subKeysome];
                    //todo this is a work around to not crash the server. only temporarly for testing
                    // if(l.logicA === false && l.logicB === false)
                    //deleteLinkFromObject(thisObject.ip, keysome, subKeysome);
                    sendDeleteLinkOO(l.nodeA , l.nodeB);
                    //realityEditor.network.deleteLinkFromObject(thisObject.ip, keysome, subKeysome);                    
                //}
            }
        }
    }
}

// Draw a dotted line from a start point to a finish point on a canvas 
function drawDotLine(context, lineStartPoint, lineEndPoint, b1, b2) {
	context.beginPath();
	context.moveTo(lineStartPoint[0], lineStartPoint[1]);
	context.lineTo(lineEndPoint[0], lineEndPoint[1]);
	context.setLineDash([10]);
	context.lineWidth = 8;
	context.strokeStyle = "#ff019f";//"#00fdff";
	context.stroke();
	context.closePath();
}

// All parameters are strings for identifying them
function makeConnection(objectA, objectB, nodeA, nodeB){
    // New connection between nodes
    var object = objects[objectA];
    var linkID = objectA + nodeA + nodeB;
    object.links[linkID] = new Link();
    object.links[linkID].objectA = objectA; //object1.name; //object1.code
    object.links[linkID].objectB = objectB; //object2.name; //object2.code
    object.links[linkID].nodeA = nodeA; //"node0"; 
    object.links[linkID].nodeB = nodeB; //"node1"; 
}

// Creates a link between objects in the server
function sendCreateLinkOO(nodeA , nodeB) {
    $.ajax({
        // la URL para la petición
        url : 'http://200.126.23.138:1880/LINK/OO',
     
        // The information to send as parameters
        data : { 
                 code1: nodeA, 
                 code2: nodeB
               },
        // POST or GET or some http method
        type : 'GET',
        // Information return type
        dataType : 'jsonp',
        // Information send type
        contentType: 'text/plain',
        xhrFields: {
            // The 'xhrFields' property sets additional fields on the XMLHttpRequest.
            // This can be used to set the 'withCredentials' property.
            // Set the value to 'true' if you'd like to pass cookies to the server.
            // If this is enabled, your server must respond with the header
            // 'Access-Control-Allow-Credentials: true'.
            withCredentials: true
        },
        // When the request is successful 
        success : function(json){console.log(json);},
        // When the request fails 
        // status code: status
        // xhr: raw petition
        error : function(xhr, status) {
            console.log('Disculpe, existió un problema');
        },
        // Executes no matter what, when the petition has been executed
        complete : function(xhr, status) {
           console.log('Petición realizada');
        }
    });
}

// Deletes a link between objects in the server
function sendDeleteLinkOO(nodeA , nodeB){
    $.ajax({
        // la URL para la petición
        url : 'http://200.126.23.138:1880/LINK/DELETE',
     
        // The information to send as parameters
        data : { code1: nodeA, code2: nodeB},
        // POST or GET or some http method
        type : 'GET',
        // Information return type
        dataType : 'jsonp',
        // Information send type
        contentType: 'text/plain',
        xhrFields: {
            // The 'xhrFields' property sets additional fields on the XMLHttpRequest.
            // This can be used to set the 'withCredentials' property.
            // Set the value to 'true' if you'd like to pass cookies to the server.
            // If this is enabled, your server must respond with the header
            // 'Access-Control-Allow-Credentials: true'.
            withCredentials: true
        },
        // When the request is successful 
        success : function(json){console.log(json);},
        // When the request fails 
        // status code: status
        // xhr: raw petition
        error : function(xhr, status) {
            console.log('Disculpe, existió un problema');
        },
        // Executes no matter what, when the petition has been executed
        complete : function(xhr, status) {
           console.log('Petición realizada');
        }
    });
}

// Creates a link between objects (circular nodes) in the app and the server
// All parameters are strings for identifying them
function makeConnectionOnServer(objectA, objectB, nodeA, nodeB){
    // New connection between nodes in the app
    makeConnection(objectA, objectB, nodeA, nodeB);
    // New connection between nodes in the server
    sendCreateLinkOO(nodeA , nodeB);
}


// Position interface in Three.js: HTML content (could be a div, iframe)
function positionInterfaceIn3D(interface) {
    var augmentedInterface = new THREE.CSS3DObject(interface);
    augmentedInterface.position.z = -0.5;
    userLocation.add(augmentedInterface);
    augmentedInterface.scale.set(0.0005, 0.0005, 0.0005 );
    return augmentedInterface;
}

// Generate an interface to position in 3D, based on the name
// interfaceName: string
function generateUI(interfaceName,x, y){
    //interfaceName = 'http://200.126.23.63:1337/vuforia/knob/index.html';
    
    // Create the HTML to place in the scene graph
    // Create the div that will contain the iframe
    var div = document.createElement('div');
    div.className = 'interactive';
    
    // Create the iframe that will contain the augmented interface, settings its properties for being interactive and to look great.
    var iframe = document.createElement('iframe');
    iframe.src = interfaceName;
    iframe.frameBorder = 0;
    iframe.setAttribute("sandbox", "allow-forms allow-pointer-lock allow-same-origin allow-scripts");
    iframe.className = 'interactive';
    iframe.style.height = "250px";
    iframe.style.width = "250px";
    div.style.left = x;
    div.style.top = y;
    div.appendChild(iframe);

    return positionInterfaceIn3D(div);
}

// Generate object
function createObjectWithData(objectID, objectName){
    // Create object from data obtained from request
    var object1 = new Objects();
    object1.name = objectName; //object.code
    object1.id = objectID;
    // Add to collection of all objects
    objects[object1.id] = object1;   
    return object1;
}

// Generate object
function createObjectWithData(objectID, objectName){
    // Create object from data obtained from request
    var object1 = new Objects();
    object1.name = objectName; //object.code
    object1.id = objectID;
    // Add to collection of all objects
    objects[object1.id] = object1;   
    return object1;
}

// Generate nodes for object
function createNodes(id, x1, y1, x2, y2){
    var nodes = {}; // A node is an object
    nodes["node0"] = new Node();
    nodes["node0"].x = x1;
    nodes["node0"].y = y1;
    nodes["node1"] = new Node();
    nodes["node1"].x = x2;
    nodes["node1"].y = y2;
    return nodes;
}

// Transform the datatypes from the json received from the server to the objects representation in the app
function mapObjects(json){
    for (var i in json){
        var dev = json[i];
        /////// Device //////
        // Convert to Object
        var object1 = new Objects();
        object1.name = dev.code; //object.code
        object1.id = dev._id;
        object1.online = dev.online;
        object1.target = dev.target;
        object1.trackable = dev.trackable;
        
        // Add to collection of all objects
        objects[object1.name] = object1;   

        /////// Object ///////    
        for (var key in dev.objects){
            var obj = dev.objects[key];
            
            // Convert to Node 
            object1.nodes[key] = new Node();
            var node = object1.nodes[key];
            node.x = obj.x;
            node.y = obj.y;
            node.src = obj.src;
            
            // Generate interface for node
            var nodeID = object1.name + "-" + key;
            var container = drawMarker(node.x, node.y, nodeID, node.src);
            container.className = 'interactive';
            object1.nodes[key] = container;
            object1.frames[key] = positionInterfaceIn3D(container);

            /////// Action //////
            for (var key in obj.actions){
                var action = obj.actions[key];
                if (action.src !== undefined && action.src != ""){
                    //object1.interfaces[key] = generateUI('http://200.126.23.63:1337/vuforia/'+ action.src +'/index.html');
                    // Create interface for action
                    object1.interfaces[key] = generateUI(action.src +'/index.html', action.x, action.y);
                }
            }
        }
    }
    
    for (var i in json){
        var dev = json[i];
        /////// Links //////    
        for (var key in dev.links){
            var objectA = dev.links[key].objectA;
            var objectB = dev.links[key].objectB;
            var nodeA = dev.links[key].nodeA; 
            var nodeB = dev.links[key].nodeB;
            makeConnection(objectA, objectB, nodeA, nodeB);
        }
    }    
}
// objectID: string
function loadObject(id){
    $.ajax({
        url : 'http://200.126.23.138:1880/load/devices1',
        // The information to send
        //data : { code1 : inicio , code2 : final},
        // POST or GET or whatever
        type : 'GET',
        // Information return type
        dataType : 'jsonp',
        // Information send type
        contentType: 'text/plain',
        xhrFields: {
            // The 'xhrFields' property sets additional fields on the XMLHttpRequest.
            // This can be used to set the 'withCredentials' property.
            // Set the value to 'true' if you'd like to pass cookies to the server.
            // If this is enabled, your server must respond with the header
            // 'Access-Control-Allow-Credentials: true'.
            withCredentials: true
        },
        // When the request is successful 
        success : mapObjects,
        // When the request fails 
        // status code: status
        // xhr: raw petition
        error : function(xhr, status) {
            console.log('Disculpe, existió un problema');
        },
        // Executes no matter what when the petition has been done
        complete : function(xhr, status) {
           console.log('Petición realizada');
        }
    });
    // Get info from server via HTTP request
    /*var url = 'http://200.126.23.138:1880/load/devices1';
    //callback(JSON.parse(req.responseText), thisKey, thisNode);
    realityEditor.network.getData(url, "a", function (req) {
            console.log(req)
    });*/

    

    /*if (id == 1){
        object = createObjectWithData("chips", "StonesAndChips");
        nodes = createNodes(1, 0, 0, 20,20);
    }else{
        object = createObjectWithData("GVUBrochure", "ArgonTutorial");
        //object = createObjectWithData("chips", "StonesAndChips");
        //object = createObjectWithData("TechSquare", "ArgonTutorial");
        nodes = createNodes(2, 0, 0, 20,20);
    }
    // Create UI for object
    // Create points for making connections
    var listOfMarkers = [];
    for (var key in nodes){
        var node = nodes[key];
        var nodeID = object.id + "-" + key;
        var container = drawMarker(node.x, node.y, nodeID);
        container.className = 'interactive';
        object.nodes[key] = container;
        object.frames[key] = positionInterfaceIn3D(container);        
    }*/
    // Place object interface in 3D
    // generateUI('http://200.126.23.63:1337/vuforia/knob/index.html');
}

//////////////////////////// Vuforia ////////////////////////////

// Load vuforia dataset given an api, datasetPath(string), object(Object)
function loadDataset(api, datasetPath, trackable, object){
    api.objectTracker.createDataSet(datasetPath).then(function (dataSet) {
        //api.objectTracker.createDataSet("https://200.126.23.63:1337/resources/datasets/ArgonTutorial.xml").then(function (dataSet) {
        // the data set has been succesfully downloaded
        // tell vuforia to load the dataset.  
        dataSet.load().then(function () {
            // when it is loaded, we retrieve a list of trackables defined in the
            // dataset and set up the content for the target
            var trackables = dataSet.getTrackables();
            // tell argon we want to track a specific trackable.  Each trackable
            // has a Cesium entity associated with it, and is expressed in a 
            // coordinate frame relative to the camera.  Because they are Cesium
            // entities, we can ask for their pose in any coordinate frame we know
            // about. 
            //var gvuBrochureEntity = app.context.subscribeToEntityById(trackables["GVUBrochure"].id);
            var targetEntity = app.context.subscribeToEntityById(trackables[trackable].id);
            // create a THREE object to put on the trackable
            var object3D = new THREE.Object3D;
            scene.add(object3D);
            // the updateEvent is called each time the 3D world should be
            // rendered, before the renderEvent.  The state of your application
            // should be updated here.
            description.innerHTML = description.innerHTML + "-added";
        
            app.context.updateEvent.addEventListener(function () {
                // get the pose (in local coordinates) of the gvuBrochure target
                var targetPose = app.context.getEntityPose(targetEntity);
                // if the pose is known the target is visible, so set the
                // THREE object to the location and orientation
                if (targetPose.poseStatus & Argon.PoseStatus.KNOWN) {
                    object3D.position.copy(targetPose.position);
                    object3D.quaternion.copy(targetPose.orientation);
                }
                // when the target is first seen after not being seen, the 
                // status is FOUND.  Here, we move the 3D text object from the
                // world to the target .
                // when the target is first lost after being seen, the status 
                // is LOST.  Here, we move the 3D text object back to the world       
                // Go through the objects nodes to be added to the target 
                for (var key in object.frames){
                    var node = object.frames[key];  
                    if (targetPose.poseStatus & Argon.PoseStatus.FOUND) {
                        object3D.add(node);
                        node.position.z = -0.1; // 0
                    }
                    else if (targetPose.poseStatus & Argon.PoseStatus.LOST) {
                        node.position.z = -0.50;//-0.50;
                        userLocation.add(node);
                    }
                }
            });
            })["catch"](function (err) {
            console.log("could not load dataset: " + err.message);
        });
        // activate the dataset.
        api.objectTracker.activateDataSet(dataSet);
        description.innerHTML = description.innerHTML+ "-dataset activated";
        api.setHint(Argon.VuforiaHint.MaxSimultaneousImageTargets, 2).then(function (result) {
            console.log("setHint " + (result ? "succeeded" : "failed"));
            description.innerHTML = description.innerHTML+ "-" + "hintset";
        })["catch"](function (err) {
            console.log("could not set hint: " + err.message);
            description.innerHTML = description.innerHTML+ "-" + "could not  set hint";
        });
        
    });
}

// Activate vuforia targets, go through all objects searching for its targets
function activateTargets(){
    app.vuforia.isAvailable().then(function (available) {
        // vuforia not available on this platform
        if (!available) {
            console.warn("vuforia not available on this platform.");
            return;
        }
        // tell argon to initialize vuforia for our app, using our license information.
        app.vuforia.init({
            encryptedLicenseData: "-----BEGIN PGP MESSAGE-----\nVersion: OpenPGP.js v2.3.2\nComment: http://openpgpjs.org\n\n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\nCDjUbY1FxwlVJ4UZ7lz+8jWHO5jYY99adPoATpUaWYxm9oPxz/QR4kvgvLjl\n9Ti8379Y8qihzqsRmf6YLYyggknlt9Uyl2HjA+1zcwbDnb3I6g/XjTFUPy1D\nxZqqSEuCNDLh7m1+GDA3KXQnLIqOdcxOVzyFCDtKI9c6b0D0ezNkxUjgkoIp\nmxSSLDjzmHuPLsQVwqxP4KNU1gT7mXTnhlhsG2Vll/WZD+tuzGK8h9anf6/p\n4pCk61Dhj1hmb9msTaK4FGhmBMtJ6kQ4SzGOfFKG5IElAHidYgd0iz7AqEzX\nGttDkcHGM9iPIYUBY2r/538M/kxeVx5fBiWEkmWz5FMzqPRs3GZWYiAb2tnp\nWSDXW3B1mwznwcCkyUP6OP/c6FFmb6Rag/ZaItVAvVjmA7tXICLJPhYIs9hE\nI6zJSVZ81YtKg9Nb6Rx49qf18pQ1SWZNGrZrWaTJTLu4cu4c5v/czY5kyT0Y\n8RqNUlI5hwWU8G9LpJ5jv8dssrgcweTG/PEbCkzqz0R6W6VgDUyqo6WSGgoS\nB9or791lGcDazNT6CJ4/2Z1wBd4BSHkhSwfcPovGOleZFE24gLiG6puHyVjk\nWEIir2WXzhypwLkG/dn+ZJW1ezOvTb4gVVILHrWhNh8=\n=LoZg\n-----END PGP MESSAGE-----"
        }).then(function (api) {
            // the vuforia API is ready, so we can start using it.
            // tell argon to download a vuforia dataset.  The .xml and .dat file must be together
            // in the web directory, even though we just provide the .xml file url here 
            //var objectName = object.name;  
            //var datasetPath = "../resources/datasets/ArgonTutorial.xml";// + object.name + ".xml";
            for (var key in objects) {
                var object = objects[key];
                //var datasetPath = "../resources/datasets/"  + object.name + ".xml";
                description.innerHTML = description.innerHTML + "=" + key;
                description.innerHTML = description.innerHTML + "=" + object.target;
                loadDataset(api, "../resources/datasets/" + object.target +  ".xml", object.trackable, object);
                /*return new Promise(function(){
                    });*/
                    // enable 2 simultaneously tracked targets
                    /*api.setHint(Argon.VuforiaHint.MaxSimultaneousImageTargets, 2).then(function (result) {
                        console.log("setHint " + (result ? "succeeded" : "failed"));
                    })["catch"](function (err) {
                        console.log("could not set hint: " + err.message);
                });*/ 
            }
        })["catch"](function (err) {
            console.log("vuforia failed to initialize: " + err.message);
        });
    });
}

/////////////////////////////// Start App /////////////////////////////
// set up Argon
var app = Argon.init();
// set up THREE.  Create a scene, a perspective camera and an object
// for the user's location
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera();
var userLocation = new THREE.Object3D();
scene.add(camera);
scene.add(userLocation);
scene.autoUpdate = false;
// We use the standard WebGLRenderer when we only need WebGL-based content
var renderer = new THREE.CSS3DArgonRenderer({
    alpha: true,
    logarithmicDepthBuffer: true,
    antialias: Argon.suggestedWebGLContextAntialiasAttribute
});
//account for the pixel density of the device
//renderer.setPixelRatio(window.devicePixelRatio);
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.bottom = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
app.view.element.appendChild(renderer.domElement);

// to easily control stuff on the display
var hud = new THREE.CSS3DArgonHUD();
// We put some elements in the index.html, for convenience. 
// Here, we retrieve the description box and move it to the 
// the CSS3DArgonHUD hudElements[0].  We only put it in the left
// hud since we'll be hiding it in stereo
var description = document.getElementById('description');
hud.hudElements[0].appendChild(description);
// let's show the rendering stats
var stats = new Stats();
hud.hudElements[0].appendChild(stats.dom);

//var buttons = document.getElementById('UIButtons');
//hud.hudElements[0].appendChild(buttons);

var overlay = document.getElementById('myOverlay');
hud.hudElements[0].appendChild(overlay);

// Add the hud to the app
app.view.element.appendChild(hud.domElement);
// Create a canvas for drawing the lines   
globalCanvas.canvas = document.getElementById('canvas');
globalCanvas.canvas.width = globalStates.height;
globalCanvas.canvas.height = globalStates.width;

globalCanvas.context = canvas.getContext('2d');

// Add event listeners 
argonuiDiv = document.getElementById("argon");

// Set the pointermove event listener for showing the line while connecting
argonuiDiv.addEventListener("pointermove", mantainLine);


//////////////////////// DELETE LINES /////////////////////////////////
// Set the events listeners for deleting the lines
// Event triggered when selecting first connection point
argonuiDiv.addEventListener("pointerup", function(event){
    globalDelete.startPoint[0] = event.clientX;
    globalDelete.startPoint[1] = event.clientY;
    //reset(); 
});
// Event triggered when selecting the second connection point
argonuiDiv.addEventListener("pointerdown", function(event){
    deleteLines(globalDelete.startPoint[0], globalDelete.startPoint[1], event.clientX, event.clientY);
});
    
// Add the canvas to the hud
hud.hudElements[0].appendChild(globalCanvas.canvas);

loadObject(1);
//loadObject(2);
/*var stonesTextObject = new THREE.Object3D();
userLocation.add(stonesTextObject);
stonesTextObject.visible = false;
var chipsTextObject = new THREE.Object3D();
userLocation.add(chipsTextObject);
chipsTextObject.visible = false;
var loader = new THREE.FontLoader();
loader.load('../resources/fonts/helvetiker_bold.typeface.json', function (font) {
    var shaderMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: "\n            uniform float amplitude;\n            attribute vec3 customColor;\n            attribute vec3 displacement;\n            varying vec3 vNormal;\n            varying vec3 vColor;\n            void main() {\n                vNormal = normal;\n                vColor = customColor;\n                vec3 newPosition = position + normal * amplitude * displacement;\n                gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );\n            }\n        ",
        fragmentShader: "\n            varying vec3 vNormal;\n            varying vec3 vColor;\n            void main() {\n                const float ambient = 0.4;\n                vec3 light = vec3( 1.0 );\n                light = normalize( light );\n                float directional = max( dot( vNormal, light ), 0.0 );\n                gl_FragColor = vec4( ( directional + ambient ) * vColor, 1.0 );\n            }\n        "
    });
    var stonesTextMesh = createTextMesh(font, "stones", shaderMaterial);
    stonesTextObject.add(stonesTextMesh);
    stonesTextObject.scale.set(0.001, 0.001, 0.001);
    var chipsTextMesh = createTextMesh(font, "chips", shaderMaterial);
    chipsTextObject.add(chipsTextMesh);
    chipsTextObject.scale.set(0.001, 0.001, 0.001);
    // add an argon updateEvent listener to slowly change the text over time.
    // we don't have to pack all our logic into one listener.
    app.context.updateEvent.addEventListener(function () {
        uniforms.amplitude.value = 1.0 + Math.sin(Date.now() * 0.001 * 0.5);
    });
});
function createTextMesh(font, text, material) {
    var textGeometry = new THREE.TextGeometry(text, {
        font: font,
        size: 40,
        height: 5,
        curveSegments: 3,
        bevelThickness: 2,
        bevelSize: 1,
        bevelEnabled: true
    });
    textGeometry.center();
    var tessellateModifier = new THREE.TessellateModifier(8);
    for (var i = 0; i < 6; i++) {
        tessellateModifier.modify(textGeometry);
    }
    var explodeModifier = new THREE.ExplodeModifier();
    explodeModifier.modify(textGeometry);
    var numFaces = textGeometry.faces.length;
    var bufferGeometry = new THREE.BufferGeometry().fromGeometry(textGeometry);
    var colors = new Float32Array(numFaces * 3 * 3);
    var displacement = new Float32Array(numFaces * 3 * 3);
    var color = new THREE.Color();
    for (var f = 0; f < numFaces; f++) {
        var index = 9 * f;
        var h = 0.07 + 0.1 * Math.random();
        var s = 0.5 + 0.5 * Math.random();
        var l = 0.6 + 0.4 * Math.random();
        color.setHSL(h, s, l);
        var d = 5 + 20 * (0.5 - Math.random());
        for (var i = 0; i < 3; i++) {
            colors[index + (3 * i)] = color.r;
            colors[index + (3 * i) + 1] = color.g;
            colors[index + (3 * i) + 2] = color.b;
            displacement[index + (3 * i)] = d;
            displacement[index + (3 * i) + 1] = d;
            displacement[index + (3 * i) + 2] = d;
        }
    }
    bufferGeometry.addAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    bufferGeometry.addAttribute('displacement', new THREE.BufferAttribute(displacement, 3));
    var textMesh = new THREE.Mesh(bufferGeometry, material);
    return textMesh;
}*/

activateTargets();

/*
var deleteFlag = false;
*/
// create a bit of animated 3D text that says "argon.js" to display 
var uniforms = {
    amplitude: { type: "f", value: 0.0 }
};
/*
// Create the CSS3Object in the scene graph
// Create the div that will contain the iframe
var div = document.createElement('div');
div.className = 'interactive';
// Create the iframe that will contain the augmented interface, settings its properties for being interactive and to look great.
var iframe = document.createElement('iframe');
iframe.src = 'http://200.126.23.63:1337/vuforia/knob/index.html';
iframe.frameBorder = 0;
iframe.setAttribute("sandbox", "allow-forms allow-pointer-lock allow-same-origin allow-scripts");
iframe.className = 'interactive';
iframe.style.height = "250px";
iframe.style.width = "250px";
div.appendChild(iframe);

// Create points for joining
var divPoints = document.createElement("div");
divPoints.style.backgroundColor =  "lightblue";
var container0 = drawMarker("0", "0", "node0");
container0.className = 'interactive';
var container1 = drawMarker("25", "25", "node1");
container1.className = 'interactive';
var container2 = drawMarker("10", "10", "node2");

// For connecting markers

var object1 = new Objects();
var object2 = new Objects();
object1.nodes["node0"] = container0;
object2.nodes["node1"] = container1;
object1.name = "object1";
object2.name = "object2";
objects[object1.name] = object1;   
//objects[object2.name] = object2;   
/*object1.links["link1"] = new Link();
object1.links["link1"].objectA = object1.name;
object1.links["link1"].objectB = object2.name;
object1.links["link1"].nodeA = "node0"; 
object1.links["link1"].nodeB = "node1";*/
// var argonTextObject = new THREE.Object3D();
// Augmented user interface
/*var argonTextObject = new THREE.CSS3DObject(container0);
argonTextObject.position.z = -0.5;
userLocation.add(argonTextObject);
argonTextObject.scale.set(0.001, 0.001, 0.001);

var secondMarker = new THREE.CSS3DObject(container1);
secondMarker.position.z = -0.5;
userLocation.add(secondMarker);
secondMarker.scale.set(0.001, 0.001, 0.001);

app.vuforia.isAvailable().then(function (available) {
    // vuforia not available on this platform
    if (!available) {
        console.warn("vuforia not available on this platform.");
        return;
    }
    // tell argon to initialize vuforia for our app, using our license information.
    app.vuforia.init({
        encryptedLicenseData: "-----BEGIN PGP MESSAGE-----\nVersion: OpenPGP.js v2.3.2\nComment: http://openpgpjs.org\n\n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\nCDjUbY1FxwlVJ4UZ7lz+8jWHO5jYY99adPoATpUaWYxm9oPxz/QR4kvgvLjl\n9Ti8379Y8qihzqsRmf6YLYyggknlt9Uyl2HjA+1zcwbDnb3I6g/XjTFUPy1D\nxZqqSEuCNDLh7m1+GDA3KXQnLIqOdcxOVzyFCDtKI9c6b0D0ezNkxUjgkoIp\nmxSSLDjzmHuPLsQVwqxP4KNU1gT7mXTnhlhsG2Vll/WZD+tuzGK8h9anf6/p\n4pCk61Dhj1hmb9msTaK4FGhmBMtJ6kQ4SzGOfFKG5IElAHidYgd0iz7AqEzX\nGttDkcHGM9iPIYUBY2r/538M/kxeVx5fBiWEkmWz5FMzqPRs3GZWYiAb2tnp\nWSDXW3B1mwznwcCkyUP6OP/c6FFmb6Rag/ZaItVAvVjmA7tXICLJPhYIs9hE\nI6zJSVZ81YtKg9Nb6Rx49qf18pQ1SWZNGrZrWaTJTLu4cu4c5v/czY5kyT0Y\n8RqNUlI5hwWU8G9LpJ5jv8dssrgcweTG/PEbCkzqz0R6W6VgDUyqo6WSGgoS\nB9or791lGcDazNT6CJ4/2Z1wBd4BSHkhSwfcPovGOleZFE24gLiG6puHyVjk\nWEIir2WXzhypwLkG/dn+ZJW1ezOvTb4gVVILHrWhNh8=\n=LoZg\n-----END PGP MESSAGE-----"
    }).then(function (api) {
        // the vuforia API is ready, so we can start using it.
        // tell argon to download a vuforia dataset.  The .xml and .dat file must be together
        // in the web directory, even though we just provide the .xml file url here 
        api.objectTracker.createDataSet("../resources/datasets/ArgonTutorial.xml").then(function (dataSet) {
        //api.objectTracker.createDataSet("https://200.126.23.63:1337/resources/datasets/ArgonTutorial.xml").then(function (dataSet) {
            // the data set has been succesfully downloaded
            // tell vuforia to load the dataset.  
            dataSet.load().then(function () {
                // when it is loaded, we retrieve a list of trackables defined in the
                // dataset and set up the content for the target
                var trackables = dataSet.getTrackables();
                // tell argon we want to track a specific trackable.  Each trackable
                // has a Cesium entity associated with it, and is expressed in a 
                // coordinate frame relative to the camera.  Because they are Cesium
                // entities, we can ask for their pose in any coordinate frame we know
                // about.
                var gvuBrochureEntity = app.context.subscribeToEntityById(trackables["GVUBrochure"].id);
                // create a THREE object to put on the trackable
                var gvuBrochureObject = new THREE.Object3D;
                scene.add(gvuBrochureObject);
                // the updateEvent is called each time the 3D world should be
                // rendered, before the renderEvent.  The state of your application
                // should be updated here.
                app.context.updateEvent.addEventListener(function () {
                    // get the pose (in local coordinates) of the gvuBrochure target
                    var gvuBrochurePose = app.context.getEntityPose(gvuBrochureEntity);
                    // if the pose is known the target is visible, so set the
                    // THREE object to the location and orientation
                    if (gvuBrochurePose.poseStatus & Argon.PoseStatus.KNOWN) {
                        gvuBrochureObject.position.copy(gvuBrochurePose.position);
                        gvuBrochureObject.quaternion.copy(gvuBrochurePose.orientation);
                    }
                    // when the target is first seen after not being seen, the 
                    // status is FOUND.  Here, we move the 3D text object from the
                    // world to the target.
                    // when the target is first lost after being seen, the status 
                    // is LOST.  Here, we move the 3D text object back to the world       
                    if (gvuBrochurePose.poseStatus & Argon.PoseStatus.FOUND) {
                        gvuBrochureObject.add(argonTextObject);
                        argonTextObject.position.z = 0;// 0
                        gvuBrochureObject.add(secondMarker);
                        secondMarker.position.z = 0;// 0
                    }
                    else if (gvuBrochurePose.poseStatus & Argon.PoseStatus.LOST) {
                        argonTextObject.position.z = -0.50;
                        userLocation.add(argonTextObject);
                        argonTextObject.position.z = -0.50;
                        userLocation.add(secondMarker);
                    }
                });
            })["catch"](function (err) {
                console.log("could not load dataset: " + err.message);
            });
            // activate the dataset.
            api.objectTracker.activateDataSet(dataSet);
        });
        // We can load a second dataset and have both active simultaneously.
        // Load the Vuforia Stones and Chips targets, and set the MaxSimultaneousImageTargets hint
        // to 2 so two targets can be tracked simultaneously.

    })["catch"](function (err) {
        console.log("vuforia failed to initialize: " + err.message);
    });
});*/

// Function for updating the lines in every frame
function updateLines(){
    // Erase all lines (empty the canvas)
    globalCanvas.context.clearRect(0, 0, globalCanvas.canvas.width, globalCanvas.canvas.height);
    
    // When a marker is clicked, globalConnect.click is set to true
    // When the second marker is clicked, globalConnect.connected is set to true
    if (globalConnect.click){
        // globalConnect.objectA contain the name of the object of the first click, 
        // and use the information in globalConnect.nodeA to find its marker html element
        // Get that element position point and draw a line from there to the mouse position
        // the mouse position is updated every frame with an event listener of mouse move.
        var element = objects[globalConnect.objectA].nodes[globalConnect.nodeA];
        var rect = element.getBoundingClientRect();
        globalConnect.startPoint[1] = rect.top + rect.height/2;
        globalConnect.startPoint[0] = rect.left + rect.width/2;
        
        // When the second marker is clicked, it can go inside
        // Deprecated: Not necessary anymore
        /*if (globalConnect.connected){
            var element = objects[globalConnect.objectB].nodes[globalConnect.nodeB];
            rect = element.getBoundingClientRect();
            globalConnect.endPoint[1] = rect.top + rect.height/2;
            globalConnect.endPoint[0] = rect.left + rect.width/2;
        }*/
        drawDotLine(globalCanvas.context, globalConnect.startPoint, globalConnect.endPoint, 0, 0);
        
    }
    
    // Update the connection lines found in every object
    for (var key in objects) {
        var links = objects[key].links;
        for (var keylink in links){
            var link = links[keylink];
            // Get nodes from objects object
            var nodeA = objects[link.objectA].nodes[link.nodeA];
            var nodeB = objects[link.objectB].nodes[link.nodeB];
            // Obtain the actual position points of the markers 
            var connect = getPointsFromNodes(nodeA, nodeB);
    
            // Use position obtained for drawing a new line based on markers connected.*/
            drawDotLine(globalCanvas.context, connect.startPoint, connect.endPoint, 0, 0);
       
            //if (!deleteFlag){
                // drawDotLine(globalCanvas.context, [ connect.startPoint[0], connect.endPoint[1]], [connect.endPoint[0], connect.startPoint[1]], 0, 0);
                // console.log (realityEditor.gui.utilities.checkLineCross(connect.startPoint[0], connect.startPoint[1], connect.endPoint[0], connect.endPoint[1], connect.startPoint[0], connect.endPoint[1], connect.endPoint[0], connect.startPoint[1], globalCanvas.canvas.width, globalCanvas.canvas.height));
                // deleteFlag = true;
            //}
        }   
    }
}
// the updateEvent is called each time the 3D world should be
// rendered, before the renderEvent.  The state of your application
// should be updated here.
app.context.updateEvent.addEventListener(function () {
    // get the position and orientation (the "pose") of the user
    // in the local coordinate frame.
    var userPose = app.context.getEntityPose(app.context.user);
    // assuming we know the user's pose, set the position of our 
    // THREE user object to match it
    if (userPose.poseStatus & Argon.PoseStatus.KNOWN) {
        userLocation.position.copy(userPose.position);
    }
    // udpate our scene matrices
    scene.updateMatrixWorld(false);
    updateLines();
});

var viewport = null;
var subViews = null;
var rAFpending = false;
app.renderEvent.addEventListener(function () {
    // only schedule a new callback if the old one has completed
    if (!rAFpending) {
        rAFpending = true;
        viewport = app.view.viewport;
        subViews = app.view.subviews;
        window.requestAnimationFrame(renderFunc);
    }
});

// the animation callback.  
function renderFunc() {
    stats.update();
    // if we have 1 subView, we're in mono mode.  If more, stereo.
    var monoMode = subViews.length == 1;
    rAFpending = false;
    // set the renderer to know the current size of the viewport.
    // This is the full size of the viewport, which would include
    // both views if we are in stereo viewing mode
    renderer.setSize(viewport.width, viewport.height);
    hud.setSize(viewport.width, viewport.height);
    // there is 1 subview in monocular mode, 2 in stereo mode
    for (var _i = 0, subViews_1 = subViews; _i < subViews_1.length; _i++) {
        var subview = subViews_1[_i];
        // set the position and orientation of the camera for 
        // this subview
        camera.position.copy(subview.pose.position);
        camera.quaternion.copy(subview.pose.orientation);
        // the underlying system provides a full projection matrix
        // for the camera.  Use it, and then update the FOV of the 
        // camera from it (needed by the CSS Perspective DIV)
        camera.projectionMatrix.fromArray(subview.frustum.projectionMatrix);
        camera.fov = subview.frustum.fovy * 180 / Math.PI;
        // set the viewport for this view
        var _a = subview.viewport, x = _a.x, y = _a.y, width = _a.width, height = _a.height;
        renderer.setViewport(x, y, width, height, subview.index);
        // render this view.
        renderer.render(scene, camera, subview.index);
        // adjust the hud, but only in mono
        if (monoMode) {
           var _b = subview.viewport, x = _b.x, y = _b.y, width = _b.width, height = _b.height;
            hud.setViewport(x, y, width, height, subview.index);
            hud.render(subview.index);
        }
    }
}

