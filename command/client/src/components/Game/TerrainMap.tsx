import * as BABYLON from '@babylonjs/core';

export enum TerrainType {
    DEEP_WATER = 'deep_water',
    SHALLOW_WATER = 'shallow_water',
    BEACH = 'beach',
    GRASSLAND = 'grassland',
    FOREST = 'forest',
    MOUNTAIN = 'mountain',
    SNOW = 'snow'
}

export interface HexCoordinate {
    q: number;
    r: number;
}

export interface HexUserData {
    terrainType?: TerrainType;
    elevation?: number;
    placedMeshes?: BABYLON.Mesh[];
    [key: string]: any;
}

export interface HexData {
    q: number;
    r: number;
    mesh: BABYLON.Mesh;
    userData: HexUserData;
    isHovered: boolean;
    isSelected: boolean;
}

export interface HexGridConfig {
    hexSize?: number;
    gridWidth?: number;
    gridHeight?: number;
    hexHeight?: number;
    spacing?: number;
    generateTerrain?: boolean;
    noiseScale?: number;
    waterLevel?: number;
    mountainLevel?: number;
    onHexClick?: (hexData: HexData, event: BABYLON.IMouseEvent) => void;
    onHexHover?: (hexData: HexData, event: BABYLON.IMouseEvent) => void;
}

export class HexGrid {
    private readonly scene: BABYLON.Scene;
    private readonly hexes = new Map<string, HexData>();
    private readonly config: Required<Omit<HexGridConfig, 'onHexClick' | 'onHexHover'>>;
    private readonly onHexClick: (hexData: HexData, event: BABYLON.IMouseEvent) => void;
    private readonly onHexHover: (hexData: HexData, event: BABYLON.IMouseEvent) => void;
    
    private selectedHex: HexData | null = null;
    private terrainMaterials = new Map<TerrainType, BABYLON.StandardMaterial>();
    private hoverMaterial!: BABYLON.StandardMaterial;
    private selectedMaterial!: BABYLON.StandardMaterial;

    constructor(scene: BABYLON.Scene, options: HexGridConfig = {}) {
        this.scene = scene;
        
        this.config = {
            hexSize: options.hexSize ?? 1,
            gridWidth: options.gridWidth ?? 10,
            gridHeight: options.gridHeight ?? 10,
            hexHeight: options.hexHeight ?? 0.1,
            spacing: options.spacing ?? 0.05,
            generateTerrain: options.generateTerrain ?? true,
            noiseScale: options.noiseScale ?? 0.1,
            waterLevel: options.waterLevel ?? -0.3,
            mountainLevel: options.mountainLevel ?? 0.5
        };
        
        this.onHexClick = options.onHexClick ?? this.defaultClickHandler.bind(this);
        this.onHexHover = options.onHexHover ?? this.defaultHoverHandler.bind(this);
        
        this.createMaterials();
        this.setupPointerEvents();
        this.ensureLighting();
    }
    
    private createMaterials(): void {
        // Terrain materials with realistic colors
        const terrainColors = {
            [TerrainType.DEEP_WATER]: new BABYLON.Color3(0.1, 0.2, 0.6),
            [TerrainType.SHALLOW_WATER]: new BABYLON.Color3(0.2, 0.4, 0.8),
            [TerrainType.BEACH]: new BABYLON.Color3(0.9, 0.8, 0.6),
            [TerrainType.GRASSLAND]: new BABYLON.Color3(0.3, 0.7, 0.2),
            [TerrainType.FOREST]: new BABYLON.Color3(0.1, 0.5, 0.1),
            [TerrainType.MOUNTAIN]: new BABYLON.Color3(0.5, 0.4, 0.3),
            [TerrainType.SNOW]: new BABYLON.Color3(0.9, 0.9, 1.0)
        };

        Object.entries(terrainColors).forEach(([terrain, color]) => {
            const material = new BABYLON.StandardMaterial(`terrain_${terrain}`, this.scene);
            material.diffuseColor = color;
            
            // Special effects for water
            if (terrain === TerrainType.DEEP_WATER || terrain === TerrainType.SHALLOW_WATER) {
                material.specularColor = new BABYLON.Color3(0.8, 0.8, 1.0);
                material.specularPower = 128;
            } else {
                material.specularColor = BABYLON.Color3.Black();
            }
            
            this.terrainMaterials.set(terrain as TerrainType, material);
        });
        
        // Hover material
        this.hoverMaterial = new BABYLON.StandardMaterial("hexHover", this.scene);
        this.hoverMaterial.diffuseColor = new BABYLON.Color3(1, 1, 0.3);
        this.hoverMaterial.specularColor = BABYLON.Color3.White();
        this.hoverMaterial.specularPower = 64;
        
        // Selected material
        this.selectedMaterial = new BABYLON.StandardMaterial("hexSelected", this.scene);
        this.selectedMaterial.diffuseColor = new BABYLON.Color3(1, 0.3, 0.3);
        this.selectedMaterial.specularColor = BABYLON.Color3.White();
        this.selectedMaterial.specularPower = 32;
    }
    
   private createHexMesh(q: number, r: number): BABYLON.Mesh {
    const { hexSize, hexHeight } = this.config;
    
    // Scale factor to eliminate gaps - adjust this value as needed
    const gapFillScale = 1.02; // 2% larger
    const scaledHexSize = hexSize * gapFillScale;
    
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    // Bottom face - center + 6 outer vertices
    positions.push(0, 0, 0);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0.5);
    
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = scaledHexSize * Math.cos(angle);
        const z = scaledHexSize * Math.sin(angle);
        positions.push(x, 0, z);
        normals.push(0, -1, 0);
        uvs.push(0.5 + 0.5 * Math.cos(angle), 0.5 + 0.5 * Math.sin(angle));
    }
    
    // Top face - center + 6 outer vertices (duplicate positions for flat shading)
    positions.push(0, hexHeight, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);
    
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = scaledHexSize * Math.cos(angle);
        const z = scaledHexSize * Math.sin(angle);
        positions.push(x, hexHeight, z);
        normals.push(0, 1, 0);
        uvs.push(0.5 + 0.5 * Math.cos(angle), 0.5 + 0.5 * Math.sin(angle));
    }
    
    // Side faces - each side needs its own vertices for flat shading
    let vertexIndex = 14; // Current vertex count
    
    for (let i = 0; i < 6; i++) {
        const angle1 = (Math.PI / 3) * i;
        const angle2 = (Math.PI / 3) * ((i + 1) % 6);
        
        const x1 = scaledHexSize * Math.cos(angle1);
        const z1 = scaledHexSize * Math.sin(angle1);
        const x2 = scaledHexSize * Math.cos(angle2);
        const z2 = scaledHexSize * Math.sin(angle2);
        
        // Calculate face normal for this side
        const edge1 = new BABYLON.Vector3(x2 - x1, 0, z2 - z1);
        const edge2 = new BABYLON.Vector3(0, hexHeight, 0);
        const faceNormal = BABYLON.Vector3.Cross(edge1, edge2).normalize();
        
        // Four vertices for this side face
        positions.push(x1, 0, z1);          // bottom left
        positions.push(x2, 0, z2);          // bottom right  
        positions.push(x1, hexHeight, z1);  // top left
        positions.push(x2, hexHeight, z2);  // top right
        
        // Same normal for all 4 vertices of this face
        for (let j = 0; j < 4; j++) {
            normals.push(faceNormal.x, faceNormal.y, faceNormal.z);
            uvs.push(j % 2, Math.floor(j / 2)); // Simple UV mapping
        }
        
        // Two triangles for this side
        indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        indices.push(vertexIndex + 1, vertexIndex + 3, vertexIndex + 2);
        
        vertexIndex += 4;
    }
    
    // Bottom face indices
    for (let i = 0; i < 6; i++) {
        indices.push(0, ((i + 1) % 6) + 1, i + 1);
    }
    // Top face indices
    for (let i = 0; i < 6; i++) {
        indices.push(7, i + 8, ((i + 1) % 6) + 8);
    }

    const mesh = new BABYLON.Mesh(`hex_${q}_${r}`, this.scene);
    const vertexData = new BABYLON.VertexData();
    
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;
    
    vertexData.applyToMesh(mesh);
    
    return mesh;
}
    private ensureLighting(): void {
        // Check if scene has lighting, if not add basic lighting
        const hasLight = this.scene.lights.length > 0;
        
        if (!hasLight) {
            // Add hemispheric light for ambient lighting
            const light = new BABYLON.HemisphericLight("hexGridLight", new BABYLON.Vector3(0, 1, 0), this.scene);
            light.intensity = 1.0;
            light.diffuse = new BABYLON.Color3(1, 1, 1);
            light.specular = new BABYLON.Color3(1, 1, 1);
            light.groundColor = new BABYLON.Color3(0.3, 0.3, 0.3);
        }
    }
    
    private generateElevation(q: number, r: number): number {
        const { noiseScale } = this.config;
        
        // Simple Perlin-like noise using multiple sine waves
        const x = q * noiseScale;
        const y = r * noiseScale;
        
        let elevation = 0;
        elevation += Math.sin(x * 2) * 0.5;
        elevation += Math.sin(y * 2) * 0.5;
        elevation += Math.sin((x + y) * 1.5) * 0.3;
        elevation += Math.sin((x - y) * 3) * 0.2;
        elevation += Math.sin(x * 7 + y * 3) * 0.1;
        
        // Normalize to -1 to 1 range
        return elevation / 1.6;
    }
    
    private getTerrainType(elevation: number): TerrainType {
        const { waterLevel, mountainLevel } = this.config;
        
        if (elevation < waterLevel) {
            return TerrainType.DEEP_WATER;
        } else if (elevation < waterLevel + 0.1) {
            return TerrainType.SHALLOW_WATER;
        } else if (elevation < waterLevel + 0.2) {
            return TerrainType.BEACH;
        } else if (elevation < mountainLevel) {
            return TerrainType.GRASSLAND;
        } else if (elevation < mountainLevel + 0.3) {
            return TerrainType.FOREST;
        } else if (elevation < mountainLevel + 0.5) {
            return TerrainType.MOUNTAIN;
        } else {
            return TerrainType.SNOW;
        }
    }
    
    private hexToWorld(q: number, r: number): BABYLON.Vector3 {
        const hexSize = this.config.hexSize + this.config.spacing;
        const x = hexSize * (3/2 * q);
        const z = hexSize * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r);
        return new BABYLON.Vector3(x, 0, z);
    }
    
    private worldToHex(worldPos: BABYLON.Vector3): HexCoordinate {
        const hexSize = this.config.hexSize + this.config.spacing;
        const q = Math.round((2/3 * worldPos.x) / hexSize);
        const r = Math.round((-1/3 * worldPos.x + Math.sqrt(3)/3 * worldPos.z) / hexSize);
        return { q, r };
    }
    
    private getHexKey(q: number, r: number): string {
        return `${q}_${r}`;
    }
    
    createHex(q: number, r: number, userData: HexUserData = {}): HexData {
        const key = this.getHexKey(q, r);
        
        if (this.hexes.has(key)) {
            return this.hexes.get(key)!;
        }
        
        const mesh = this.createHexMesh(q, r);
        const worldPos = this.hexToWorld(q, r);
        mesh.position = worldPos;
        
        // Generate terrain if enabled
        let finalUserData = userData;
        if (this.config.generateTerrain && !userData.terrainType) {
            const elevation = this.generateElevation(q, r);
            const terrainType = this.getTerrainType(elevation);
            
            finalUserData = {
                ...userData,
                elevation,
                terrainType
            };
            
            // Adjust hex height based on elevation
            const elevationHeight = elevation * this.config.hexHeight * 3;
            mesh.position.y = Math.max(0, elevationHeight);
        }
        
        const hexData: HexData = {
            q,
            r,
            mesh,
            userData: { ...finalUserData, placedMeshes: [] },
            isHovered: false,
            isSelected: false
        };
        
        // Set terrain material
        this.updateHexMaterial(hexData);
        
        (mesh as any).hexData = hexData;
        this.hexes.set(key, hexData);
        
        return hexData;
    }
    
    createGrid(): void {
        const { gridWidth, gridHeight } = this.config;
        
        for (let q = -Math.floor(gridWidth/2); q <= Math.floor(gridWidth/2); q++) {
            for (let r = -Math.floor(gridHeight/2); r <= Math.floor(gridHeight/2); r++) {
                if (Math.abs(q) + Math.abs(r) + Math.abs(-q-r) <= Math.max(gridWidth, gridHeight)) {
                    this.createHex(q, r);
                }
            }
        }
    }
    
    getHex(q: number, r: number): HexData | undefined {
        return this.hexes.get(this.getHexKey(q, r));
    }
    
    getHexAt(worldPos: BABYLON.Vector3): HexData | undefined {
        const { q, r } = this.worldToHex(worldPos);
        return this.getHex(q, r);
    }
    
    selectHex(hexData: HexData | null): void {
        if (this.selectedHex) {
            this.selectedHex.isSelected = false;
            this.updateHexMaterial(this.selectedHex);
        }
        
        if (hexData) {
            hexData.isSelected = true;
            this.selectedHex = hexData;
            this.updateHexMaterial(hexData);
        } else {
            this.selectedHex = null;
        }
    }
    
    hoverHex(hexData: HexData | null): void {
        this.hexes.forEach(hex => {
            if (hex.isHovered && hex !== hexData) {
                hex.isHovered = false;
                this.updateHexMaterial(hex);
            }
        });
        
        if (hexData && !hexData.isSelected) {
            hexData.isHovered = true;
            this.updateHexMaterial(hexData);
        }
    }
    
    clearHover(): void {
        this.hexes.forEach(hex => {
            if (hex.isHovered) {
                hex.isHovered = false;
                this.updateHexMaterial(hex);
            }
        });
    }
    
    private updateHexMaterial(hexData: HexData): void {
        if (hexData.isSelected) {
            hexData.mesh.material = this.selectedMaterial;
        } else if (hexData.isHovered) {
            hexData.mesh.material = this.hoverMaterial;
        } else if (hexData.userData.terrainType) {
            const terrainMaterial = this.terrainMaterials.get(hexData.userData.terrainType);
            hexData.mesh.material = terrainMaterial || this.terrainMaterials.get(TerrainType.GRASSLAND)!;
        } else {
            hexData.mesh.material = this.terrainMaterials.get(TerrainType.GRASSLAND)!;
        }
    }
    
    private setupPointerEvents(): void {
        let currentHover: HexData | null = null;
        
        this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
                case BABYLON.PointerEventTypes.POINTERMOVE:
                    const pickInfo = this.scene.pick(
                        pointerInfo.event.clientX, 
                        pointerInfo.event.clientY
                    );
                    
                    if (pickInfo.hit && pickInfo.pickedMesh && (pickInfo.pickedMesh as any).hexData) {
                        const hexData = (pickInfo.pickedMesh as any).hexData as HexData;
                        if (currentHover !== hexData) {
                            currentHover = hexData;
                            this.hoverHex(hexData);
                            this.onHexHover(hexData, pointerInfo.event);
                        }
                    } else {
                        if (currentHover) {
                            this.clearHover();
                            currentHover = null;
                        }
                    }
                    break;
                    
                case BABYLON.PointerEventTypes.POINTERDOWN:
                    const clickInfo = this.scene.pick(
                        pointerInfo.event.clientX, 
                        pointerInfo.event.clientY
                    );
                    
                    if (clickInfo.hit && clickInfo.pickedMesh && (clickInfo.pickedMesh as any).hexData) {
                        const hexData = (clickInfo.pickedMesh as any).hexData as HexData;
                        this.selectHex(hexData);
                        this.onHexClick(hexData, pointerInfo.event);
                    } else {
                        this.selectHex(null);
                    }
                    break;
            }
        });
    }
    
    private defaultClickHandler(hexData: HexData, event: BABYLON.IMouseEvent): void {
        console.log(`Clicked ${hexData.userData.terrainType} hex at (${hexData.q}, ${hexData.r})`, hexData);
    }
    
    private defaultHoverHandler(hexData: HexData, event: BABYLON.IMouseEvent): void {
        console.log(`Hovering ${hexData.userData.terrainType} hex at (${hexData.q}, ${hexData.r})`);
    }
    
    getNeighbors(q: number, r: number): HexData[] {
        const directions: HexCoordinate[] = [
            { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
            { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
        ];
        
        return directions
            .map(dir => ({ q: q + dir.q, r: r + dir.r }))
            .map(coord => this.getHex(coord.q, coord.r))
            .filter((hex): hex is HexData => hex !== undefined);
    }
    
    getHexesByTerrainType(terrainType: TerrainType): HexData[] {
        return Array.from(this.hexes.values())
            .filter(hex => hex.userData.terrainType === terrainType);
    }
    
    setHexTerrain(q: number, r: number, terrainType: TerrainType): void {
        const hex = this.getHex(q, r);
        if (hex) {
            hex.userData.terrainType = terrainType;
            this.updateHexMaterial(hex);
        }
    }
    
    setHexUserData(q: number, r: number, userData: Partial<HexUserData>): void {
        const hex = this.getHex(q, r);
        if (hex) {
            hex.userData = { ...hex.userData, ...userData };
            this.updateHexMaterial(hex);
        }
    }
    
    getAllHexes(): HexData[] {
        return Array.from(this.hexes.values());
    }
    
    getSelectedHex(): HexData | null {
        return this.selectedHex;
    }
    
    addMeshToHex(q: number, r: number, mesh: BABYLON.Mesh, offset?: BABYLON.Vector3): boolean {
        const hex = this.getHex(q, r);
        if (!hex) {
            return false;
        }
        
        // Position mesh at hex center + offset
        const hexWorldPos = this.hexToWorld(q, r);
        mesh.position.x = hexWorldPos.x + (offset?.x || 0);
        mesh.position.z = hexWorldPos.z + (offset?.z || 0);
        mesh.position.y = hex.mesh.position.y + (offset?.y || 0.1); // Slightly above hex surface
        
        // Track the mesh
        if (!hex.userData.placedMeshes) {
            hex.userData.placedMeshes = [];
        }
        hex.userData.placedMeshes.push(mesh);
        
        return true;
    }

    addTreesToHex(q: number, r: number, treeMesh: BABYLON.Sprite, count: number, offset?: BABYLON.Vector3): boolean {
            const hex = this.getHex(q, r);
            if (!hex) {
                return false;
            }
            const spriteManagerTrees = new BABYLON.SpriteManager("treesManager", "textures/palm.png", 2000, {width: 512, height: 1024},this.scene);
            const treeR = new BABYLON.Sprite("tree", spriteManagerTrees);
            treeR.width = 1;
            treeR.height = 2;
            
            // Get the center position of the hex
            const hexWorldPos = this.hexToWorld(q, r);

            // Track the trees in the hex's user data
            if (!hex.userData.placedTrees) {
                hex.userData.placedTrees = [];
            }

            for (let i = 0; i < count; i++) {

                const treeR = new BABYLON.Sprite("tree", spriteManagerTrees);
                treeR.width = 1;
                treeR.height = 2;

                // Create a clone of the tree mesh for each instance
                const treeInstance = treeR;

                // Randomly position the tree within the hexagon
                const randomAngle = Math.random() * Math.PI * 2; // Random angle
                const randomRadius = Math.random() * (this.config.hexSize * 0.5); // Random radius within half the hex size

                // Calculate the position within the hex
                const treeX = hexWorldPos.x + randomRadius * Math.cos(randomAngle);
                const treeZ = hexWorldPos.z + randomRadius * Math.sin(randomAngle);
                const treeY = hex.mesh.position.y + (offset?.y || 0.1); // Slightly above hex surface

                // Set the position of the tree instance
                treeInstance.position.set(treeX, treeY, treeZ);

                // Add the tree instance to the hex's user data
                hex.userData.placedTrees.push(treeInstance);
            }

            return true;
        }

    
    removeMeshFromHex(q: number, r: number, mesh: BABYLON.Mesh): boolean {
        const hex = this.getHex(q, r);
        if (!hex || !hex.userData.placedMeshes) {
            return false;
        }
        
        const index = hex.userData.placedMeshes.indexOf(mesh);
        if (index > -1) {
            hex.userData.placedMeshes.splice(index, 1);
            mesh.dispose();
            return true;
        }
        
        return false;
    }
    
    clearMeshesFromHex(q: number, r: number): void {
        const hex = this.getHex(q, r);
        if (!hex || !hex.userData.placedMeshes) {
            return;
        }
        
        hex.userData.placedMeshes.forEach(mesh => mesh.dispose());
        hex.userData.placedMeshes = [];
    }
    
    getMeshesOnHex(q: number, r: number): BABYLON.Mesh[] {
        const hex = this.getHex(q, r);
        return hex?.userData.placedMeshes || [];
    }
    
    createTreeMesh(name: string = "tree"): BABYLON.Mesh {
        const tree = new BABYLON.Mesh(name, this.scene);
        
        // Trunk (cylinder)
        const trunk = BABYLON.MeshBuilder.CreateCylinder("trunk", {
            height: 0.3,
            diameterTop: 0.05,
            diameterBottom: 0.08,
            tessellation: 8
        }, this.scene);
        trunk.position.y = 0.15;
        
        // Foliage (sphere)
        const foliage = BABYLON.MeshBuilder.CreateSphere("foliage", {
            diameter: 0.3,
            segments: 8
        }, this.scene);
        foliage.position.y = 0.35;
        
        // Materials
        const trunkMaterial = new BABYLON.StandardMaterial("trunkMat", this.scene);
        trunkMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0.1);
        trunk.material = trunkMaterial;
        
        const foliageMaterial = new BABYLON.StandardMaterial("foliageMat", this.scene);
        foliageMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.4, 0.1);
        foliage.material = foliageMaterial;
        
        // Merge meshes
        trunk.parent = tree;
        foliage.parent = tree;
        
        return tree;
    }
    
    createRockMesh(name: string = "rock"): BABYLON.Mesh {
        const rock = BABYLON.MeshBuilder.CreateSphere("rock", {
            diameter: 0.15,
            segments: 6
        }, this.scene);
        
        // Flatten and make irregular
        rock.scaling = new BABYLON.Vector3(1, 0.6, 0.8);
        
        const rockMaterial = new BABYLON.StandardMaterial("rockMat", this.scene);
        rockMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        rock.material = rockMaterial;
        
        return rock;
    }
    
    createBuildingMesh(name: string = "building"): BABYLON.Mesh {
        const building = BABYLON.MeshBuilder.CreateBox("building", {
            width: 0.3,
            height: 0.4,
            depth: 0.3
        }, this.scene);
        
        building.position.y = 0.2;
        
        const buildingMaterial = new BABYLON.StandardMaterial("buildingMat", this.scene);
        buildingMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.5, 0.4);
        building.material = buildingMaterial;
        
        return building;
    }
    
    dispose(): void {
        this.hexes.forEach(hexData => {
            // Dispose placed meshes first
            if (hexData.userData.placedMeshes) {
                hexData.userData.placedMeshes.forEach(mesh => mesh.dispose());
            }
            hexData.mesh.dispose();
        });
        this.hexes.clear();
        
        this.terrainMaterials.forEach(material => material.dispose());
        this.terrainMaterials.clear();
        
        this.hoverMaterial.dispose();
        this.selectedMaterial.dispose();
    }
}

// Usage example:
/*
const hexGrid = new HexGrid(scene, {
    hexSize: 1,
    gridWidth: 15,
    gridHeight: 15,
    hexHeight: 0.2,
    generateTerrain: true,
    noiseScale: 0.15,
    waterLevel: -0.2,
    mountainLevel: 0.4,
    onHexClick: (hexData: HexData, event: BABYLON.IMouseEvent) => {
        console.log(`Clicked ${hexData.userData.terrainType} at (${hexData.q}, ${hexData.r})`);
        
        // Example: Add a tree when clicking on grassland
        if (hexData.userData.terrainType === TerrainType.GRASSLAND) {
            const tree = hexGrid.createTreeMesh(`tree_${hexData.q}_${hexData.r}`);
            hexGrid.addMeshToHex(hexData.q, hexData.r, tree);
        }
        
        // Example: Add a building when clicking on a selected hex
        if (hexData.isSelected && hexData.userData.terrainType !== TerrainType.DEEP_WATER) {
            const building = hexGrid.createBuildingMesh(`building_${hexData.q}_${hexData.r}`);
            hexGrid.addMeshToHex(hexData.q, hexData.r, building, new BABYLON.Vector3(0, 0, 0));
        }
    },
    onHexHover: (hexData: HexData, event: BABYLON.IMouseEvent) => {
        console.log(`Hovering over ${hexData.userData.terrainType}`);
    }
});

hexGrid.createGrid();

// Add some trees to forest hexes
const forestHexes = hexGrid.getHexesByTerrainType(TerrainType.FOREST);
forestHexes.slice(0, 10).forEach(hex => {
    const tree = hexGrid.createTreeMesh(`forest_tree_${hex.q}_${hex.r}`);
    hexGrid.addMeshToHex(hex.q, hex.r, tree);
});

// Add rocks to mountain hexes
const mountainHexes = hexGrid.getHexesByTerrainType(TerrainType.MOUNTAIN);
mountainHexes.slice(0, 5).forEach(hex => {
    const rock = hexGrid.createRockMesh(`mountain_rock_${hex.q}_${hex.r}`);
    hexGrid.addMeshToHex(hex.q, hex.r, rock);
});

// Manually place a building
const building = hexGrid.createBuildingMesh("custom_building");
hexGrid.addMeshToHex(0, 0, building, new BABYLON.Vector3(0.2, 0, 0.1));
*/