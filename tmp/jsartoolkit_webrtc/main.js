function copyMatrixGl2Threejs(m, tMat) {
	return tMat.set(
		m[0], m[4], m[8], m[12],
		m[1], m[5], m[9], m[13],
		m[2], m[6], m[10], m[14],
		m[3], m[7], m[11], m[15]
	);
};
function copyMatrixAr2Gl(mat, cm) {
	cm[0] = mat.m00;
	cm[1] = -mat.m10;
	cm[2] = mat.m20;
	cm[3] = 0;
	cm[4] = mat.m01;
	cm[5] = -mat.m11;
	cm[6] = mat.m21;
	cm[7] = 0;
	cm[8] = -mat.m02;
	cm[9] = mat.m12;
	cm[10] = -mat.m22;
	cm[11] = 0;
	cm[12] = mat.m03;
	cm[13] = -mat.m13;
	cm[14] = mat.m23;
	cm[15] = 1;
}

var threshold	= 128;
var threshold	= 40;
// to enable/disable debug output in jsartoolkit
DEBUG		= true;

// create the video element for the webcam
var videoEl	= document.createElement('video');
videoEl.width	= 320;
videoEl.height	= 240;
videoEl.loop	= true;
videoEl.volume	= 0;
videoEl.autoplay= true;
videoEl.controls= true;

if( true ){
	navigator.getUserMedia('video', function(stream) {
		var url		= window.URL.createObjectURL(stream);
		videoEl.src	= url;
	}, function(error) {
		alert("Couldn't access webcam.");
	});
	threshold	= 128;
	document.body.appendChild(videoEl);
	var srcElement	= videoEl;
}

if( false ){
	videoEl.src = './swap_loop.ogg';
	document.body.appendChild(videoEl);	
	var srcElement	= videoEl;
	threshold	= 50;
}

if( false ){
	var image	= document.createElement("img");
	image.setAttribute('src', 'armchair.jpg');
	document.body.appendChild(image);
	var srcElement	= image;
	threshold	= 150;
}


var onload	= function() {
	var canvasRaster	= document.createElement('canvas');
	canvasRaster.width	= 320;
	canvasRaster.height	= 240;
	canvasRaster.width	= 320*2;
	canvasRaster.height	= 240*2;
	//canvasRaster.width	= srcElement.width;
	//canvasRaster.height	= srcElement.height;
	document.body.appendChild(canvasRaster);

	// apparently debug canvas is directly updated by jsartoolkit
	// - usefull to get debug info for tunning
	// - FIXME the way it is exported is dirty tho
	var debugCanvas		= document.createElement('canvas');
	debugCanvas.id		= 'debugCanvas';
	debugCanvas.width	= canvasRaster.width;
	debugCanvas.height	= canvasRaster.height;
	document.body.appendChild(debugCanvas);

	var videoCanvas		= document.createElement('canvas');
	videoCanvas.width	= srcElement.width;
	//videoCanvas.height	= srcElement.width*3/4;	// ASK: so jsartoolkit work only with 3/4 aspect ?
							// truncate: the output.. no cool
	videoCanvas.height	= srcElement.height;
							
	var ctxRaster	= canvasRaster.getContext('2d');
      
	var arRaster	= new NyARRgbRaster_Canvas2D(canvasRaster);
	var arParam	= new FLARParam(canvasRaster.width,canvasRaster.height);
	var arDetector	= new FLARMultiIdMarkerDetector(arParam, 120);
	arDetector.setContinueMode(true);
      
	// setup three.js renderer
	var renderer	= new THREE.WebGLRenderer();
	renderer.setSize(640, 480);
	//document.body.appendChild(renderer.domElement);
	document.body.insertBefore(renderer.domElement, document.body.firstChild);

	// create the scene
	var scene	= new THREE.Scene();
	
	// setup lights
	var light	= new THREE.DirectionalLight(0xffffff);
	light.position.set(400, 500, 100).normalize();
	scene.add(light);
	var light	= new THREE.DirectionalLight(0xffffff);
	light.position.set(-400, -500, -100);
	scene.add(light);
      
	// Create a camera and a marker root object for your Three.js scene.
	var camera	= new THREE.Camera();
	scene.add(camera);
	
	// Next we need to make the Three.js camera use the FLARParam matrix.
	var tmpGlMatCam	= new Float32Array(16);
	arParam.copyCameraMatrix(tmpGlMatCam, 10, 10000);
	copyMatrixGl2Threejs(tmpGlMatCam, camera.projectionMatrix);

	var videoTex = new THREE.Texture(videoCanvas);
      
	// Create scene and quad for the video.
	var plane	= new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 0), new THREE.MeshBasicMaterial({map: videoTex}) );
	plane.material.depthTest	= false;
	plane.material.depthWrite	= false;
	var videoCam	= new THREE.Camera();
	var videoScene	= new THREE.Scene();
	videoScene.add(plane);
	videoScene.add(videoCam);
      
	var markers	= {};
	
	animate();
	
	function processAr(){
		//videoCanvas.getContext('2d').drawImage(videoEl,0,0);
		//videoCanvas.getContext('2d').drawImage(videoEl,0,0, videoCanvas.width, videoCanvas.height);
		videoCanvas.getContext('2d').drawImage(srcElement,0,0, videoCanvas.width, videoCanvas.height);
		
		//;(function(){
		//	var ctx	= videoCanvas.getContext('2d');
		//	ctx.save();
		//	ctx.translate(videoCanvas.width,0);
		//	ctx.scale(-1,1);
		//	ctx.drawImage(srcElement,0,0, videoCanvas.width, videoCanvas.height);
		//	ctx.restore();
		//})();
		
		//ctxRaster.drawImage(videoCanvas, 0,0, 320, 240);
		ctxRaster.drawImage(videoCanvas, 0,0, ctxRaster.canvas.width, ctxRaster.canvas.height);

		canvasRaster.changed	= true;

		videoTex.needsUpdate	= true;
		
		// detect markers
		var nDetected	= arDetector.detectMarkerLite(arRaster, threshold);
		var tmpArMat	= new NyARTransMatResult();
		for (var idx = 0; idx < nDetected; idx++) {
			var markerId;
			// extract the markerId
			var id	= arDetector.getIdMarkerData(idx);
			if (id.packetLength > 4) {
				markerId = -1;
			}else{
				markerId = 0;
				for (var i = 0; i < id.packetLength; i++ ) {
					markerId = (markerId << 8) | id.getPacketData(i);
				}
			}
			// define the marker if needed
			markers[markerId]	= markers[markerId] || {};
			markers[markerId].age	= 0;
			// FIXME Object.asCopy is a dirty kludge - jsartoolkit is declaring this on global space 
			arDetector.getTransformMatrix(idx, tmpArMat);
			markers[markerId].transform = Object.asCopy(tmpArMat);
		}
		// handle markers age
		Object.keys(markers).forEach(function(markerId){
			var marker = markers[markerId];
			if( marker.age > 3) {
				delete markers[markerId];
				scene.remove(marker.object3d);
			}
			marker.age++;
		});
		// create and update object3d associated to markers
		var tmpGlMat	= new Float32Array(16);
		Object.keys(markers).forEach(function(markerId){
			var marker = markers[markerId];
			if (!marker.object3d) {
				marker.object3d = new THREE.Object3D();
				var cube = new THREE.Mesh(
					new THREE.CubeGeometry(100,100,100),
					new THREE.MeshLambertMaterial({color: 0|(0xffffff*Math.random())})
					//new THREE.MeshNormalMaterial({color: 0|(0xffffff*Math.random())})
				);
				cube.position.z = -50;
				cube.doubleSided = true;
				marker.object3d.matrixAutoUpdate = false;
				marker.object3d.add(cube);
				scene.add(marker.object3d);
			}
			copyMatrixAr2Gl(marker.transform, tmpGlMat);
			copyMatrixGl2Threejs(tmpGlMat, marker.object3d.matrix);

			marker.object3d.matrixWorldNeedsUpdate = true;				
		});
	}

	function render(){
		console.dir(srcElement)
		if( srcElement instanceof HTMLImageElement ){
			processAr();			
		}else if( srcElement instanceof HTMLVideoElement && srcElement.readyState === srcElement.HAVE_ENOUGH_DATA ){
			processAr();
		}
		
		// trigger the rendering
		renderer.autoClear = false;
		renderer.clear();
		renderer.render(videoScene, videoCam);
		renderer.render(scene, camera);
	};
	function animate(){
		
		requestAnimationFrame(animate);
		
		render();
	};
}
window.onload	= onload;
