import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import CommandNexusGUI from './UI';
import { WeatherSystem } from './Weather';
import Skybox from './Skybox';
import { Color4 } from '@babylonjs/core';
import { HexGrid, TerrainType, type HexData } from './TerrainMap';
// import HexagonalTerrainMap from './TerrainMap';


// Loading Screen Component
const LoadingScreen: React.FC<{ progress: number; status: string }> = ({ progress, status }) => (
  <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
    <div className="text-center">
      {/* Animated Logo/Title */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 animate-pulse">
          Command Nexus
        </h1>
        <div className="w-16 h-1 bg-blue-500 mx-auto animate-pulse"></div>
      </div>
      
      {/* Progress Bar */}
      <div className="w-80 bg-gray-700 rounded-full h-2 mb-4">
        <div 
          className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      {/* Status Text */}
      <p className="text-gray-300 text-lg mb-4">{status}</p>
      
      {/* Progress Percentage */}
      <p className="text-white text-xl font-mono">{Math.round(progress)}%</p>
      
      {/* Animated Dots */}
      <div className="flex justify-center space-x-1 mt-6">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  </div>
);

const MainScene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const cameraRef = useRef<BABYLON.ArcRotateCamera | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  
  // Camera constants - INCREASED ZOOM LIMITS
  const CAMERA_SPEED = 0.5;
  const ROTATION_SPEED = 0.05;
  const ZOOM_SPEED = 5;
  const MIN_ZOOM = 5;    // Much closer zoom (was 15)
  const MAX_ZOOM = 100;  // Much farther zoom (was 30)

  const createScene = async () => {
    if (!canvasRef.current) return;

    try {
      setLoadingStatus('Creating engine...');
      setLoadingProgress(10);
      
      // Create engine and scene
      const engine = new BABYLON.Engine(canvasRef.current, true);
      engineRef.current = engine;
      
      setLoadingStatus('Setting up scene...');
      setLoadingProgress(20);
      
      const scene = new BABYLON.Scene(engine);
      sceneRef.current = scene;
      scene.clearColor = new Color4(0.2, 0.2, 0.2, 1);
      

      const gl = engine._gl;



    // const skybox = new Skybox("textures/skybox/mountain/",gl);

    // gl.enable(gl.DEPTH_TEST);
    // gl.enable(gl.BLEND);
 


      
      setLoadingStatus('Configuring camera...');
      setLoadingProgress(30);
      
      // Create ArcRotate camera for better isometric control
      const camera = new BABYLON.ArcRotateCamera(
        "camera", 
        Math.PI / 4, // alpha (horizontal rotation)
        Math.PI / 3, // beta (vertical angle for isometric view)
        20, // radius
        BABYLON.Vector3.Zero(), // target
        scene
      );
      
      	// var skybox = BABYLON.MeshBuilder.CreateBox("skyBox", {size:1000.0}, scene);
        // var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
        // skyboxMaterial.backFaceCulling = false;
        // skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("textures/skybox", scene);
        // skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        // skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        // skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        // skybox.material = skyboxMaterial;

            // Create Weather System
      const weatherSystem = new WeatherSystem(scene,camera);

        // Example of setting weather manually
      weatherSystem.setWeather("clear");
        
      // Set zoom limits with increased range
      camera.lowerRadiusLimit = MIN_ZOOM;
      camera.upperRadiusLimit = MAX_ZOOM;
      camera.position = new BABYLON.Vector3(1.297781854469696,12.935054148614336,0.011680352061435906)
      
      cameraRef.current = camera;
      
      setLoadingStatus('Setting up controls...');
      setLoadingProgress(40);
      
      // Enhanced keyboard and mouse controls
      const keys = { w: false, s: false, a: false, d: false, q: false, e: false, r: false, f: false };
      
      // Mouse control variables
      let isMouseDown = false;
      let lastMouseX = 0;
      let lastMouseY = 0;
      
      // Keyboard controls
      scene.onKeyboardObservable.add((kbInfo) => {
        const key = kbInfo.event.key.toLowerCase();
        if (key in keys) {
          keys[key as keyof { w: boolean; s: boolean; a: boolean; d: boolean; q: boolean; e: boolean; r: boolean; f: boolean; }] = kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN;
        }
      });
      
      // Mouse controls using Babylon.js pointer events - FIXED ROTATION
      scene.onPointerObservable.add((pointerInfo) => {
        switch (pointerInfo.type) {
          case BABYLON.PointerEventTypes.POINTERDOWN:
            if (pointerInfo.event.button === 0) { // Left mouse button
              isMouseDown = true;
              lastMouseX = scene.pointerX;
              lastMouseY = scene.pointerY;
            }
            break;
            
          case BABYLON.PointerEventTypes.POINTERUP:
            if (pointerInfo.event.button === 0) {
              isMouseDown = false;
            }
            break;
            
          case BABYLON.PointerEventTypes.POINTERMOVE:
            if (isMouseDown) {
              const deltaX = scene.pointerX - lastMouseX;
              const deltaY = scene.pointerY - lastMouseY;
              
              // FIXED: Reduced mouse sensitivity and corrected rotation direction
              const mouseSensitivity = 0.003; // Much slower (was 0.01)
              
              // FIXED: Corrected rotation directions
              camera.alpha -= deltaX * mouseSensitivity; // Horizontal rotation (drag left = rotate left)
              camera.beta -= deltaY * mouseSensitivity;  // Vertical rotation (drag up = rotate up)
              
              // Clamp beta to prevent camera from flipping
              camera.beta = Math.max(0.1, Math.min(Math.PI - 0.1, camera.beta));
              
              lastMouseX = scene.pointerX;
              lastMouseY = scene.pointerY;
            }
            break;
            
          case BABYLON.PointerEventTypes.POINTERWHEEL:
            const wheelEvent = pointerInfo.event as WheelEvent;
            const wheelDelta = wheelEvent.deltaY;
            // Smoother zoom with better scaling
            camera.radius += wheelDelta * 0.01; // Slightly increased for better response
            camera.radius = Math.max(camera.lowerRadiusLimit!, Math.min(camera.radius, camera.upperRadiusLimit!));
            break;
        }
      });
      
      scene.onBeforeRenderObservable.add(() => {
        let cameraSpeed = BABYLON.Vector3.Zero();
        
        // Get camera's actual viewing direction in world space
        const forward = camera.getTarget().subtract(camera.position).normalize();
        forward.y = 0; // Project onto XZ plane
        forward.normalize();
        
        // Get right vector from forward
        const right = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up()).normalize();
        
        // Movement (exact same logic as your reference)
        if (keys['w']) cameraSpeed.addInPlace(forward.scale(CAMERA_SPEED));
        if (keys['s']) cameraSpeed.addInPlace(forward.scale(-CAMERA_SPEED));
        if (keys['d']) cameraSpeed.addInPlace(right.scale(-CAMERA_SPEED));
        if (keys['a']) cameraSpeed.addInPlace(right.scale(CAMERA_SPEED));
        camera.target.addInPlace(cameraSpeed);
        
        // Rotation and zoom with increased zoom limits
        if (keys['q']) camera.alpha += ROTATION_SPEED;
        if (keys['e']) camera.alpha -= ROTATION_SPEED;
        if (keys['r']) camera.radius -= ZOOM_SPEED;
        if (keys['f']) camera.radius += ZOOM_SPEED;
        camera.radius = Math.max(camera.lowerRadiusLimit!, Math.min(camera.radius, camera.upperRadiusLimit!));
      });
      
      setLoadingStatus('Creating lighting...');
      setLoadingProgress(50);
      
      // Create lights
      const hemisphericLight = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);
      hemisphericLight.intensity = 0.7;
      
      const directionalLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -1, -1), scene);
      directionalLight.intensity = 0.5;
      
      setLoadingStatus('Generating terrain...');
      setLoadingProgress(60);
      
      // Create ground
      const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 50, height: 50}, scene);
      const groundMaterial = new BABYLON.StandardMaterial("groundMat", scene);
      groundMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
      groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
      ground.material = groundMaterial;
      ground.position.y = -0.5;


      scene.onBeforeRenderObservable.add(() => {
        console.log(camera.position)
      
      })
      
      setLoadingStatus('Loading ...');
      setLoadingProgress(70);
      
      // Load GLB model with progress tracking
      try {
        

        const hexGrid = new HexGrid(scene, {
            hexSize: 1,
            gridWidth: 30,
            gridHeight: 30,
            hexHeight: 0.2,
            generateTerrain: true,
            noiseScale: 0.15,
            waterLevel: -0.2,
            mountainLevel: 0.4,
            onHexClick: (hexData: HexData, event: BABYLON.IMouseEvent) => {
                console.log(`Clicked ${hexData.userData.terrainType} at (${hexData.q}, ${hexData.r})`);
                console.log(`Elevation: ${hexData.userData.elevation?.toFixed(2)}`);
            },
            onHexHover: (hexData: HexData, event: BABYLON.IMouseEvent) => {
                console.log(`Hovering over ${hexData.userData.terrainType}`);
            }
        });

        hexGrid.createGrid();


        // Get all water hexes
        const waterHexes = hexGrid.getHexesByTerrainType(TerrainType.DEEP_WATER);

        // Manually set terrain for specific hex
        hexGrid.setHexTerrain(0, 0, TerrainType.MOUNTAIN);

                // Create and place a tree
        const tree = hexGrid.createTreeMesh("myTree");
        hexGrid.addMeshToHex(5, 3, tree);

        const numberOfTrees = 10

        const spriteManagerTrees = new BABYLON.SpriteManager("treesManager", "textures/palm.png", 2000, {width: 512, height: 1024},scene);
        const treeR = new BABYLON.Sprite("tree", spriteManagerTrees);
        treeR.width = 1;
        treeR.height = 2;


        hexGrid.addTreesToHex(5, 3, treeR, numberOfTrees);

        

        // Place with offset
        const building = hexGrid.createBuildingMesh("town_hall");
        hexGrid.addMeshToHex(0, 0, building, new BABYLON.Vector3(0.2, 0, 0.1));

        // Auto-populate terrain with appropriate meshes
        const forestHexes = hexGrid.getHexesByTerrainType(TerrainType.FOREST);
        forestHexes.forEach(hex => {
            const tree = hexGrid.createTreeMesh(`tree_${hex.q}_${hex.r}`);
            hexGrid.addMeshToHex(hex.q, hex.r, tree);
        });

        setLoadingStatus('Model loaded successfully!');
        setLoadingProgress(90);
        
      } catch (error) {
        console.error("Error loading GLB model:", error);
        
        setLoadingStatus('Model failed, using fallback...');
        
        // Create a fallback box if model fails to load
        const box = BABYLON.MeshBuilder.CreateBox("fallbackBox", {size: 2}, scene);
        box.position.y = 1;
        
        const material = new BABYLON.StandardMaterial("fallbackMat", scene);
        material.diffuseColor = new BABYLON.Color3(1, 0, 0);
        box.material = material;
        
        setLoadingProgress(90);
      }

      setLoadingStatus('Initializing GUI...');
      setLoadingProgress(95);
      
      const gui = new CommandNexusGUI(scene);
      
      setLoadingStatus('Starting render loop...');
      setLoadingProgress(100);
      
      // Start render loop
      engine.runRenderLoop(() => {
        scene.render();
      });
      
      // Handle window resize
      window.addEventListener('resize', () => {
        engine.resize();
      });
      
      // Hide loading screen after everything is ready
      setTimeout(() => {
        setIsLoading(false);
      }, 500); // Small delay to show 100% completion
      
    } catch (error) {
      console.error('Error creating scene:', error);
      setLoadingStatus('Error loading scene');
      setLoadingProgress(0);
    }
  };

  useEffect(() => {
    // Initialize scene
    createScene();
    
    // Cleanup
    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
      }
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  return (
    <>
      {/* Loading Screen Overlay */}
      {isLoading && (
        <LoadingScreen 
          progress={loadingProgress} 
          status={loadingStatus} 
        />
      )}
      
      {/* Main Canvas */}
      <canvas 
        ref={canvasRef}
        style={{ 
          width: '100vw', 
          height: '100vh', 
          display: 'block',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.5s ease-in-out'
        }}
        tabIndex={0}
      />
    </>
  );
};

export default MainScene;