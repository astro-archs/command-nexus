import * as BABYLON from '@babylonjs/core';
import * as GUI from '@babylonjs/gui';
import { Rectangle, TextBlock } from '@babylonjs/gui';

// Types
interface Unit {
  id: number;
  type: 'infantry';
  player: number;
  x: number;
  y: number;
  z: number;
  health: number;
  supply: number;
  status: 'idle' | 'defending' | 'patrolling' | 'moving' | 'stealth';
}

interface Building {
  id: number;
  type: 'commandCenter' | 'barracks' | 'armory';
  player: number;
  x: number;
  y: number;
  health: number;
}

interface BattlefieldData {
  width: number;
  height: number;
  units: Unit[];
  buildings: Building[];
}

interface GameState {
  selectedUnit: Unit | null;
  activeAction: string | null;
  currentPlayer: number;
  turnTimer: number;
  gameState: 'active' | 'paused';
}

class CommandNexusGUI {
  private advancedTexture: GUI.AdvancedDynamicTexture;
  private scene: BABYLON.Scene;
  
  // UI References
  private panels: { [key: string]: GUI.Rectangle } = {};
  private buttons: { [key: string]: GUI.Button } = {};
  private texts: { [key: string]: GUI.TextBlock } = {};
  private tooltip: GUI.Rectangle = new Rectangle;
  private tooltipText: GUI.TextBlock = new TextBlock;
  // Game State
  private gameState: GameState = {
    selectedUnit: null,
    activeAction: null,
    currentPlayer: 1,
    turnTimer: 180,
    gameState: 'active'
  };
  
  private battlefield: BattlefieldData = {
    width: 20,
    height: 20,
    units: [
      { id: 1, type: 'infantry', player: 1, x: 2, y: 3, z: 0, health: 100, supply: 80, status: 'idle' },

    ],
    buildings: [
      { id: 1, type: 'commandCenter', player: 1, x: 1, y: 1, health: 100 },
      { id: 2, type: 'barracks', player: 1, x: 3, y: 1, health: 100 },
      { id: 3, type: 'commandCenter', player: 2, x: 18, y: 18, health: 85 },
    ]
  };

  private actions = [
    { id: 'move', name: 'Move', hotkey: 'M' },
    { id: 'attack', name: 'Attack', hotkey: 'A' },
    { id: 'defend', name: 'Defend', hotkey: 'D' },
    { id: 'patrol', name: 'Patrol', hotkey: 'P' },
    { id: 'stealth', name: 'Stealth', hotkey: 'S' },
    { id: 'heal', name: 'Heal', hotkey: 'H' },
    { id: 'recon', name: 'Recon', hotkey: 'R' },
    { id: 'boost', name: 'Boost', hotkey: 'B' },
    { id: 'capture', name: 'Capture Flag', hotkey: 'C' }
  ];

  private unitTypes = {
    infantry: { color: '#10B981', symbol: '🪖', name: 'Infantry' },
  };

  private buildingTypes = {
    commandCenter: { color: '#DC2626', symbol: '🏛️', name: 'Command Center', height: 1.5 },
    barracks: { color: '#7C2D12', symbol: '🏗️', name: 'Barracks', height: 1.0 },
    armory: { color: '#374151', symbol: '⚔️', name: 'Armory', height: 0.8 }
  };

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("CommandNexusUI");
    this.initialize();
  }

  private initialize(): void {
    this.createMainLayout();
    this.setupKeyboardControls();
    this.startTimer();
  }

  private createMainLayout(): void {
    this.createHeaderPanel();
    this.createActionPanel();
    //this.createBattlefieldPanel();
    this.createInfoPanel();
    this.createStatusPanel();
  }

  private createHeaderPanel(): void {
    const headerPanel = new GUI.Rectangle("headerPanel");
    headerPanel.widthInPixels = window.innerWidth;
    headerPanel.heightInPixels = 40;
    headerPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    headerPanel.background = "transparent";
    headerPanel.color = "rgba(71, 85, 105, 1)";
    headerPanel.thickness = 0;
    this.advancedTexture.addControl(headerPanel);
    this.panels.header = headerPanel;


    // Game ID Panel
    const gameIdPanel = new GUI.Rectangle("gameIdPanel");
    gameIdPanel.widthInPixels = 120;
    gameIdPanel.heightInPixels = 30;
    gameIdPanel.background = "rgba(30, 41, 59, 1)";
    gameIdPanel.cornerRadius = 8;
    gameIdPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    gameIdPanel.paddingLeftInPixels = 200;
    headerPanel.addControl(gameIdPanel);

    const gameIdText = new GUI.TextBlock("gameId", "Game ID: 1");
    gameIdText.fontSize = 14;
    gameIdText.color = "white";
    gameIdPanel.addControl(gameIdText);

    // Timer
    const timerText = new GUI.TextBlock("timer", this.formatTime(this.gameState.turnTimer));
    timerText.fontSize = 20;
    timerText.color = this.gameState.turnTimer < 30 ? "#ef4444" : "#b0f0dbff";
    timerText.fontWeight = "bold";
    timerText.fontFamily = "monospace";
    timerText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    timerText.paddingRightInPixels = 200;
    headerPanel.addControl(timerText);
    this.texts.timer = timerText;

    // Current Player
    const playerText = new GUI.TextBlock("player", `Player ${this.gameState.currentPlayer}`);
    playerText.fontSize = 18;
    playerText.color = this.gameState.currentPlayer === 1 ? "#60a5fa" : "#f87171";
    playerText.fontWeight = "bold";
    playerText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    playerText.paddingRightInPixels = 50;
    headerPanel.addControl(playerText);
    this.texts.player = playerText;
  }

private createActionPanel(): void {
  const actionPanel = new GUI.Rectangle("actionPanel");
  actionPanel.widthInPixels = 140; // Reduced from 200
  actionPanel.heightInPixels = window.innerHeight - 120;
  actionPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  actionPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  actionPanel.topInPixels = 40;
  actionPanel.background = "transparent";
  actionPanel.color = "rgba(71, 85, 105, 1)";
  actionPanel.thickness = 0;
  this.advancedTexture.addControl(actionPanel);
  this.panels.action = actionPanel;

  // Tooltip at the top (smaller)
  const tooltip = new GUI.Rectangle("actionTooltip");
  tooltip.widthInPixels = 130; // Reduced from 180
  tooltip.heightInPixels = 40; // Reduced from 50
  tooltip.background = "rgba(15, 23, 42, 0.95)";
  tooltip.cornerRadius = 4;
  tooltip.thickness = 1;
  tooltip.color = "#475569";
  tooltip.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  tooltip.topInPixels = 5;
  actionPanel.addControl(tooltip);

  const tooltipText = new GUI.TextBlock("tooltipText", "Hover action");
  tooltipText.fontSize = 10; // Reduced from 12
  tooltipText.color = "#cbd5e1";
  tooltipText.textWrapping = true;
  tooltipText.paddingLeftInPixels = 6;
  tooltipText.paddingRightInPixels = 6;
  tooltipText.fontStyle = "italic";
  tooltip.addControl(tooltipText);

  // Actions Header (removed to save space)
  // const actionsHeader = new GUI.TextBlock("actionsHeader", "Actions");
  // actionsHeader.fontSize = 16;
  // actionsHeader.color = "white";
  // actionsHeader.fontWeight = "bold";
  // actionsHeader.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  // actionsHeader.topInPixels = 75;
  // actionPanel.addControl(actionsHeader);

  // Action Buttons Container - 3-column Grid Layout
  const buttonContainer = new GUI.Rectangle("buttonContainer");
  buttonContainer.widthInPixels = 140;
  const rows = Math.ceil(this.actions.length / 3); // 3 columns
  buttonContainer.heightInPixels = Math.min(250, rows * 45 + 30);
  buttonContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  buttonContainer.topInPixels = 80;
  buttonContainer.background = "rgba(71, 85, 105, 1)";
  buttonContainer.thickness = 0;
  buttonContainer.cornerRadius = 8;
  actionPanel.addControl(buttonContainer);

  // Create action buttons in 3-column grid
  for (let i = 0; i < this.actions.length; i++) {
    const action = this.actions[i];
    const row = Math.floor(i / 3);
    const col = i % 3;
    
    // Create icon button
    const button = GUI.Button.CreateImageOnlyButton(`action_${action.id}`, this.getActionIconUrl(action.id));
    button.widthInPixels = 36;
    button.heightInPixels = 36;
    button.leftInPixels = (col - 1) * 50; // Center the 3-column grid with 50px spacing
    button.topInPixels = row * 45 - (rows * 22.5);
    button.color = this.gameState.selectedUnit ? "#e2e8f0" : "#64748b";
    button.background = this.gameState.selectedUnit ? "#475569" : "#1e293b";
    button.cornerRadius = 8;
    button.thickness = 1;
    button.paddingTopInPixels = 6;
    button.paddingBottomInPixels = 6;
    button.paddingLeftInPixels = 6;
    button.paddingRightInPixels = 6;

    // Hotkey indicator overlay
    const hotkeyIndicator = new GUI.TextBlock(`hotkey_${action.id}`, action.hotkey);
    hotkeyIndicator.fontSize = 8;
    hotkeyIndicator.color = "#fbbf24";
    hotkeyIndicator.fontWeight = "bold";
    hotkeyIndicator.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    hotkeyIndicator.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    hotkeyIndicator.topInPixels = -2;
    hotkeyIndicator.leftInPixels = -2;
    hotkeyIndicator.shadowOffsetX = 1;
    hotkeyIndicator.shadowOffsetY = 1;
    hotkeyIndicator.shadowColor = "black";
    button.addControl(hotkeyIndicator);

    // Click handler
    button.onPointerClickObservable.add(() => {
      if (this.gameState.selectedUnit) {
        this.setActiveAction(this.gameState.activeAction === action.id ? null : action.id);
      }
    });

    // Tooltip handlers - update the fixed tooltip at top
    button.onPointerEnterObservable.add(() => {
      if (this.gameState.selectedUnit) {
        button.background = "#64748b";
      }
      
      // Update tooltip text
      tooltipText.text = `${action.name} [${action.hotkey}]`;
      tooltipText.fontStyle = "normal";
      tooltipText.color = "white";
    });
    
    button.onPointerOutObservable.add(() => {
      button.background = this.gameState.selectedUnit ? "#475569" : "#1e293b";
      
      // Reset tooltip text
      tooltipText.text = "Hover over an action";
      tooltipText.fontStyle = "italic";
      tooltipText.color = "#cbd5e1";
    });

    // Active state indicator
    if (this.gameState.activeAction === action.id) {
      button.background = "#059669";
      button.color = "white";
    }

    buttonContainer.addControl(button);
    this.buttons[`action_${action.id}`] = button;
  }

  // Store tooltip references for later use
  this.tooltip = tooltip;
  this.tooltipText = tooltipText;

  // Calculate positions for info panels based on action panel content
  const actionPanelContentHeight = 105 + Math.min(250, rows * 45 + 20);
  this.createSelectedUnitInfo(actionPanel, actionPanelContentHeight + 20);
  this.createBattlefieldInfo(actionPanel, actionPanelContentHeight + 180);
}

// Helper method to get action icon URLs (optimized for larger 50x50 buttons)
private getActionIconUrl(actionId: string): string {
  const iconMap: { [key: string]: string } = {
    'move': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE3IDNMMjAgOUgyNkwyMCAxMUwyMyAxN0wxNyAxNUwxMSAxN0wxNCAxMUw4IDlIMTRMMTcgM1oiIGZpbGw9IiM2MzY2ZjEiIHN0cm9rZT0iIzQ4NGNjNiIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KPHBhdGggZD0iTTE3IDE5TDIzIDI1SDE3TDE0IDMxTDExIDI1SDE3WiIgZmlsbD0iIzYzNjZmMSIgc3Ryb2tlPSIjNDg0Y2M2IiBzdHJva2Utd2lkdGg9IjEuNSIvPgo8L3N2Zz4=',
    'attack': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcgN0wyNyAyN0wyNCAzMEw0IDEwTDcgN1oiIGZpbGw9IiNlZjQ0NDQiIHN0cm9rZT0iI2RjMzYyNiIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KPGVsbGlwc2UgY3g9IjI0IiBjeT0iMTAiIHJ4PSI0IiByeT0iMyIgZmlsbD0iIzk5MWIxYiIvPgo8cGF0aCBkPSJNNCA5TDI0IDI5TDI3IDI3TDcgN0w0IDlaIiBmaWxsPSIjZWY0NDQ0Ii8+Cjwvc3ZnPg==',
    'defend': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE3IDNMMjggOFYxN0MyOCAyNC4yNDQyIDIzLjQxODMgMzEgMTcgMzFDMTAuNTgxNyAzMSA2IDI0LjI0NDIgNiAxN1Y4TDE3IDNaIiBmaWxsPSIjM2I4MmY2IiBzdHJva2U9IiMyZDcwZDQiIHN0cm9rZS13aWR0aD0iMS41Ii8+CjxwYXRoIGQ9Ik0xNyA4TDIzIDEyVjIwQzIzIDIyLjc2MTQgMjAuNzYxNCAyNSAxNyAyNUMxMy4yMzg2IDI1IDExIDIyLjc2MTQgMTEgMjBWMTJMMTcgOFoiIGZpbGw9IiMxZTQwYWYiLz4KPC9zdmc+',
    'heal': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTciIGN5PSIxNyIgcj0iMTQiIGZpbGw9IiMxMGI5ODEiIHN0cm9rZT0iIzA1OWI2OSIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KPHBhdGggZD0iTTE3IDlWMjVNOSAxN0gyNSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+',
    'spell': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE3IDNMMjAgMTFMMjggOUwyMCAxN0wyOCAyNUwyMCAyM0wxNyAzMUwxNCAyM0w2IDI1TDE0IDE3TDYgOUwxNCAxMUwxNyAzWiIgZmlsbD0iI2Y1OWUwYiIgc3Ryb2tlPSIjZDk3ZjA2IiBzdHJva2Utd2lkdGg9IjEuNSIvPgo8Y2lyY2xlIGN4PSIxNyIgY3k9IjE3IiByPSI0IiBmaWxsPSIjZmZiZjAwIi8+Cjwvc3ZnPg==',
    'build': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjI2IiBoZWlnaHQ9IjI2IiBmaWxsPSIjOGI1Y2Y2IiBzdHJva2U9IiM3YzNhZWQiIHN0cm9rZS13aWR0aD0iMS41Ii8+CjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjE0IiBoZWlnaHQ9IjE0IiBmaWxsPSIjNmQyOGQ5Ii8+CjxyZWN0IHg9IjEzIiB5PSIxMyIgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0iIzRjMWQ5NSIvPgo8L3N2Zz4=',
    'scout': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTciIGN5PSIxNyIgcj0iNCIgZmlsbD0iIzA2YmNkNCIgc3Ryb2tlPSIjMDg5MWI5IiBzdHJva2Utd2lkdGg9IjEuNSIvPgo8Y2lyY2xlIGN4PSIxNyIgY3k9IjE3IiByPSIxMSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDZiY2Q0IiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWRhc2hhcnJheT0iNSA1Ii8+CjxwYXRoIGQ9Ik0xNyA2VjlNMTcgMjVWMjhNNiAxN0g5TTI1IDE3SDI4IiBzdHJva2U9IiMwNmJjZDQiIHN0cm9rZS13aWR0aD0iMi41Ii8+Cjwvc3ZnPg==',
    'retreat': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI4IDE3SDZNNiA3TDE1IDE3TDYgMjciIHN0cm9rZT0iI2Y5NzMxNiIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZmlsbD0ibm9uZSIvPgo8cmVjdCB4PSIyMiIgeT0iMTQiIHdpZHRoPSI2IiBoZWlnaHQ9IjYiIGZpbGw9IiNmOTczMTYiLz4KPC9zdmc+',
    'special': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzQiIHZpZXdCb3g9IjAgMCAzNCAzNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE3IDNMMjEgMTNMMzEgMTdMMjEgMjFMMTcgMzFMMTMgMjFMMyAxN0wxMyAxM0wxNyAzWiIgZmlsbD0iI2VjNGE5OSIgc3Ryb2tlPSIjZGIyNzc3IiBzdHJva2Utd2lkdGg9IjEuNSIvPgo8Y2lyY2xlIGN4PSIxNyIgY3k9IjE3IiByPSI1IiBmaWxsPSIjZmRkZjQ4Ii8+Cjwvc3ZnPg=='
  };
  
  return iconMap[actionId] || iconMap['move']; // Default to move icon if not found
}

// Method to update button states (call when active action changes)
// private updateActionButtons(): void {
//   for (let i = 0; i < this.actions.length; i++) {
//     const action = this.actions[i];
//     const button = this.buttons[`action_${action.id}`] as GUI.Button;
    
//     if (button) {
//       if (this.gameState.activeAction === action.id) {
//         button.background = "#059669";
//         button.color = "white";
//       } else {
//         button.background = this.gameState.selectedUnit ? "#475569" : "#1e293b";
//         button.color = this.gameState.selectedUnit ? "#e2e8f0" : "#64748b";
//       }
//     }
//   }
// }

private createSelectedUnitInfo(parent: GUI.Rectangle, topPosition: number): void {
  const unitInfoPanel = new GUI.Rectangle("unitInfoPanel");
  unitInfoPanel.widthInPixels = 140;
  unitInfoPanel.heightInPixels = 140;
  unitInfoPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  unitInfoPanel.topInPixels = topPosition;
  unitInfoPanel.background = "rgba(51, 65, 85, 0.8)";
  unitInfoPanel.cornerRadius = 8;
  unitInfoPanel.thickness = 0;
  parent.addControl(unitInfoPanel);

  const unitInfoHeader = new GUI.TextBlock("unitInfoHeader", "Selected Unit");
  unitInfoHeader.fontSize = 14;
  unitInfoHeader.color = "rgba(25, 150, 9, 1)";
  unitInfoHeader.fontWeight = "bold";
  unitInfoHeader.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  unitInfoHeader.topInPixels = 10;
  unitInfoPanel.addControl(unitInfoHeader);

  const unitDetails = new GUI.TextBlock("unitDetails", "No unit selected");
  unitDetails.fontSize = 11;
  unitDetails.color = "#31af38ff";
  unitDetails.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  unitDetails.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  unitDetails.topInPixels = 35;
  unitDetails.paddingLeftInPixels = 10;
  unitDetails.paddingRightInPixels = 10;
  unitInfoPanel.addControl(unitDetails);

  this.texts.unitDetails = unitDetails;
}

private createBattlefieldInfo(parent: GUI.Rectangle, topPosition: number): void {
  const battlefieldInfoPanel = new GUI.Rectangle("battlefieldInfoPanel");
  battlefieldInfoPanel.widthInPixels = 140;
  battlefieldInfoPanel.heightInPixels = 140;
  battlefieldInfoPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  battlefieldInfoPanel.topInPixels = topPosition;
  battlefieldInfoPanel.background = "transparent";
  battlefieldInfoPanel.cornerRadius = 8;
  battlefieldInfoPanel.thickness = 0;
  parent.addControl(battlefieldInfoPanel);

  const battlefieldHeader = new GUI.TextBlock("battlefieldInfoHeader", "Battlefield Info");
  battlefieldHeader.fontSize = 14;
  battlefieldHeader.color = "rgba(186, 243, 174, 1)";
  battlefieldHeader.fontWeight = "bold";
  battlefieldHeader.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  battlefieldHeader.topInPixels = 5;
  battlefieldInfoPanel.addControl(battlefieldHeader);

  const battlefieldDetails = new GUI.TextBlock("battlefieldDetails", 
    `Size: ${this.battlefield.width}×${this.battlefield.height}\n` +
    `Units: ${this.battlefield.units.length}\n` +
    `Buildings: ${this.battlefield.buildings.length}`
  );
  battlefieldDetails.fontSize = 11;
  battlefieldDetails.color = "#63d35fff";
  battlefieldDetails.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  battlefieldDetails.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  battlefieldDetails.topInPixels = 95;
  battlefieldDetails.paddingLeftInPixels = 10;
  battlefieldDetails.paddingRightInPixels = 10;
  battlefieldInfoPanel.addControl(battlefieldDetails);
}
  private createBattlefieldPanel(): void {
    const battlefieldPanel = new GUI.Rectangle("battlefieldPanel");
    battlefieldPanel.widthInPixels = window.innerWidth - 520;
    battlefieldPanel.heightInPixels = window.innerHeight - 240;
    battlefieldPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    battlefieldPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    battlefieldPanel.topInPixels = 80;
    battlefieldPanel.background = "rgba(30, 41, 59, 0.6)";
    battlefieldPanel.color = "rgba(71, 85, 105, 1)";
    battlefieldPanel.thickness = 1;
    battlefieldPanel.cornerRadius = 8;
    this.advancedTexture.addControl(battlefieldPanel);
    this.panels.battlefield = battlefieldPanel;

    // Battlefield Header
    const battlefieldHeader = new GUI.TextBlock("battlefieldHeader", "3D Tactical Theater");
    battlefieldHeader.fontSize = 20;
    battlefieldHeader.color = "white";
    battlefieldHeader.fontWeight = "bold";
    battlefieldHeader.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    battlefieldHeader.topInPixels = 20;
    battlefieldPanel.addControl(battlefieldHeader);

    //this.createBattlefieldGrid(battlefieldPanel);
  }

  private createBattlefieldGrid(parent: GUI.Rectangle): void {
    const gridContainer = new GUI.Rectangle("gridContainer");
    gridContainer.widthInPixels = 600;
    gridContainer.heightInPixels = 400;
    gridContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    gridContainer.background = "rgba(15, 23, 42, 0.8)";
    gridContainer.cornerRadius = 8;
    parent.addControl(gridContainer);

    // Create grid cells
    const cellSize = 20;
    const gridWidth = 20;
    const gridHeight = 20;

    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const cell = new GUI.Rectangle(`cell_${x}_${y}`);
        cell.widthInPixels = cellSize;
        cell.heightInPixels = cellSize;
        cell.leftInPixels = (x - gridWidth/2) * cellSize;
        cell.topInPixels = (y - gridHeight/2) * cellSize;
        cell.background = "rgba(132, 204, 22, 0.3)";
        cell.color = "rgba(255, 255, 255, 0.2)";
        cell.thickness = 1;
        gridContainer.addControl(cell);

        cell.onPointerClickObservable.add(() => {
          this.handleGridClick(x, y);
        });
      }
    }

    // Add units to grid
    this.battlefield.units.forEach(unit => {
      const unitMarker = new GUI.Ellipse(`unit_marker_${unit.id}`);
      unitMarker.widthInPixels = 16;
      unitMarker.heightInPixels = 16;
      unitMarker.leftInPixels = (unit.x - gridWidth/2) * cellSize;
      unitMarker.topInPixels = (unit.y - gridHeight/2) * cellSize;
      unitMarker.background = unit.player === 1 ? "#3b82f6" : "#ef4444";
      unitMarker.thickness = this.gameState.selectedUnit?.id === unit.id ? 3 : 1;
      unitMarker.color = this.gameState.selectedUnit?.id === unit.id ? "#fbbf24" : "white";
      gridContainer.addControl(unitMarker);

      unitMarker.onPointerClickObservable.add(() => {
        if (unit.player === this.gameState.currentPlayer) {
          this.selectUnit(unit);
        }
      });
    });

    // Add buildings to grid
    this.battlefield.buildings.forEach(building => {
      const buildingMarker = new GUI.Rectangle(`building_marker_${building.id}`);
      buildingMarker.widthInPixels = 18;
      buildingMarker.heightInPixels = 18;
      buildingMarker.leftInPixels = (building.x - gridWidth/2) * cellSize;
      buildingMarker.topInPixels = (building.y - gridHeight/2) * cellSize;
      buildingMarker.background = building.player === 1 ? "#3b82f6" : "#ef4444";
      buildingMarker.cornerRadius = 2;
      gridContainer.addControl(buildingMarker);
    });
  }

 private createInfoPanel(): void {
  const infoPanel = new GUI.Rectangle("infoPanel");
  infoPanel.widthInPixels = 220;
  infoPanel.heightInPixels = window.innerHeight - 160;
  infoPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  infoPanel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
  infoPanel.topInPixels = 80;
  infoPanel.background = "transparent";
  infoPanel.color = "rgba(71, 85, 105, 1)";
  infoPanel.thickness = 0;
  this.advancedTexture.addControl(infoPanel);
  this.panels.info = infoPanel;

  // Fixed positioning from top to bottom
  this.createCombatLogSection(infoPanel);
  //this.createUnitRosterSection(infoPanel);
  this.createObjectivesSection(infoPanel);
  this.createEndTurnButton(infoPanel);
}

private createCombatLogSection(parent: GUI.Rectangle): void {
  // Header
//   const logHeader = new GUI.TextBlock("logHeader", "Combat Log");
//   logHeader.fontSize = 14;
//   logHeader.color = "white";
//   logHeader.fontWeight = "bold";
//   logHeader.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
//   logHeader.topInPixels = -350;
//   parent.addControl(logHeader);

  // Log Panel
  const combatLogPanel = new GUI.Rectangle("combatLogPanel");
  combatLogPanel.widthInPixels = 200;
  combatLogPanel.heightInPixels = 100;
  combatLogPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  combatLogPanel.topInPixels = 40;
  combatLogPanel.thickness = 0;
  combatLogPanel.background = "rgba(15, 23, 42, 0.9)";
  combatLogPanel.cornerRadius = 6;
  parent.addControl(combatLogPanel);

  const logText = new GUI.TextBlock("logText", 
    "[15:42] Enemy attacked (15,16)\n" +
    "[15:41] Air patrol completed\n" +
    "[15:40] Infantry healed 100%\n" +
    "[15:39] Turn 3 started"
  );
  logText.fontSize = 9;
  logText.color = "#cbd5e1";
  logText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  logText.topInPixels = 8;
  logText.paddingLeftInPixels = 8;
  combatLogPanel.addControl(logText);
}

private createUnitRosterSection(parent: GUI.Rectangle): void {
  // Header
  const unitCountHeader = new GUI.TextBlock("unitCountHeader", "Unit Roster");
  unitCountHeader.fontSize = 14;
  unitCountHeader.color = "white";
  unitCountHeader.fontWeight = "bold";
  unitCountHeader.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  unitCountHeader.topInPixels = 160;
  parent.addControl(unitCountHeader);

  // Roster Panel
  const rosterPanel = new GUI.Rectangle("rosterPanel");
  rosterPanel.widthInPixels = 200;
  rosterPanel.heightInPixels = 120;
  rosterPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  rosterPanel.topInPixels = 185;
  rosterPanel.background = "rgba(51, 65, 85, 0.8)";
  rosterPanel.cornerRadius = 6;
  parent.addControl(rosterPanel);

  // Unit entries
  let entryY = 10;
  Object.entries(this.unitTypes).forEach(([type, info]) => {
    const playerUnits = this.battlefield.units.filter(u => u.type === type && u.player === this.gameState.currentPlayer);
    const count = playerUnits.length;
    const avgHealth = count > 0 ? Math.round(playerUnits.reduce((sum, u) => sum + u.health, 0) / count) : 0;
    
    const unitText = new GUI.TextBlock(`unitCount_${type}`, `${info.symbol} ${info.name}: ${count}${count > 0 ? ` (${avgHealth}%)` : ''}`);
    unitText.fontSize = 10;
    unitText.color = count > 0 ? "#e2e8f0" : "#94a3b8";
    unitText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    unitText.topInPixels = entryY;
    unitText.paddingLeftInPixels = 10;
    rosterPanel.addControl(unitText);
    
    entryY += 18;
  });
}

private createObjectivesSection(parent: GUI.Rectangle): void {
  // Header
  const objectivesHeader = new GUI.TextBlock("objectivesHeader", "Objectives");
  objectivesHeader.fontSize = 14;
  objectivesHeader.color = "rgba(132, 201, 129, 1)";
  objectivesHeader.fontWeight = "bold";
  objectivesHeader.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  objectivesHeader.topInPixels = -180;
  parent.addControl(objectivesHeader);

  // Objectives Panel
  const objectivesPanel = new GUI.Rectangle("objectivesPanel");
  objectivesPanel.widthInPixels = 200;
  objectivesPanel.heightInPixels = 80;
  objectivesPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  objectivesPanel.topInPixels = 190;
  objectivesPanel.background = "transparent";
  objectivesPanel.cornerRadius = 6;
  objectivesPanel.thickness = 0;
  parent.addControl(objectivesPanel);

  const objectivesText = new GUI.TextBlock("objectivesText", 
    "🏁 Capture center flag\n" +
    "🎯 Destroy enemy units\n" +
    "🛡️ Defend your base"
  );
  objectivesText.fontSize = 10;
  objectivesText.color = "#e2e8f0";
  objectivesText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  objectivesText.topInPixels = 10;
  objectivesText.paddingLeftInPixels = 10;
  objectivesPanel.addControl(objectivesText);
}

private createEndTurnButton(parent: GUI.Rectangle): void {
  const endTurnButton = GUI.Button.CreateSimpleButton("endTurnButton", "End Turn");
  endTurnButton.widthInPixels = 180;
  endTurnButton.heightInPixels = 45;
  endTurnButton.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
  endTurnButton.bottomInPixels = 15;
  endTurnButton.background = "#2a5c2fff";
  endTurnButton.color = "white";
  endTurnButton.thickness = 0;
  endTurnButton.cornerRadius = 8;
  endTurnButton.fontSize = 14;
  endTurnButton.fontWeight = "bold";
  parent.addControl(endTurnButton);

  endTurnButton.onPointerClickObservable.add(() => {
    this.endTurn();
  });

  this.buttons.endTurn = endTurnButton;
}

  private createStatusPanel(): void {
    const statusPanel = new GUI.Rectangle("statusPanel");
    statusPanel.widthInPixels = window.innerWidth;
    statusPanel.heightInPixels = 50;
    statusPanel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
    statusPanel.background = "rgba(0, 0, 0, 0.6)";
    statusPanel.color = "rgba(71, 85, 105, 1)";
    statusPanel.thickness = 1;
    this.advancedTexture.addControl(statusPanel);

    const statusText = new GUI.TextBlock("statusText", 
      "Hotkeys: M-Move | A-Attack | D-Defend | P-Patrol | S-Stealth | H-Heal | R-Recon | B-Boost | C-Capture | ESC-Cancel | SPACE-End Turn"
    );
    statusText.fontSize = 16;
    statusText.color = "#94a3b8";
    statusPanel.addControl(statusText);
  }

  private setupKeyboardControls(): void {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
        if (!this.gameState.selectedUnit) return;
        
        const key = kbInfo.event.key.toLowerCase();
        
        switch (key) {
          case 'm':
            this.setActiveAction('move');
            break;
          case 'a':
            this.setActiveAction('attack');
            break;
          case 'd':
            this.setActiveAction('defend');
            break;
          case 'p':
            this.setActiveAction('patrol');
            break;
          case 's':
            this.setActiveAction('stealth');
            break;
          case 'h':
            this.setActiveAction('heal');
            break;
          case 'r':
            this.setActiveAction('recon');
            break;
          case 'b':
            this.setActiveAction('boost');
            break;
          case 'c':
            this.setActiveAction('capture');
            break;
          case 'escape':
            this.setActiveAction(null);
            this.selectUnit(null);
            break;
          case ' ':
            kbInfo.event.preventDefault();
            this.endTurn();
            break;
        }
      }
    });
  }

  private startTimer(): void {
    setInterval(() => {
      if (this.gameState.gameState === 'active' && this.gameState.turnTimer > 0) {
        this.gameState.turnTimer--;
        this.updateTimerDisplay();
      }
    }, 1000);
  }

  // Public methods for game state management
  public selectUnit(unit: Unit | null): void {
    this.gameState.selectedUnit = unit;
    this.updateSelectedUnitDisplay();
    this.updateActionButtons();
  }

  public setActiveAction(action: string | null): void {
    this.gameState.activeAction = action;
    this.updateActionButtons();
  }

  public executeAction(unit: Unit, action: string, targetX?: number, targetY?: number): void {
    console.log(`Executing ${action} with unit ${unit.id} at position (${targetX}, ${targetY})`);
    
    // Here you would call the actual smart contract functions
    switch (action) {
      case 'move':
        // Call move_unit function
        break;
      case 'attack':
        // Call attack function
        break;
      case 'defend':
        // Call defend function
        break;
      // ... other actions
    }
    
    this.setActiveAction(null);
  }

  public endTurn(): void {
    this.gameState.currentPlayer = this.gameState.currentPlayer === 1 ? 2 : 1;
    this.gameState.turnTimer = 180;
    this.selectUnit(null);
    this.setActiveAction(null);
    this.updatePlayerDisplay();
    this.updateTimerDisplay();
  }

  private handleGridClick(x: number, y: number): void {
    if (this.gameState.selectedUnit && this.gameState.activeAction) {
      this.executeAction(this.gameState.selectedUnit, this.gameState.activeAction, x, y);
    }
  }

  // UI Update methods
  private updateActionButtons(): void {
    this.actions.forEach(action => {
      const button = this.buttons[`action_${action.id}`];
      if (button) {
        if (this.gameState.activeAction === action.id) {
          button.background = "#0891b2";
          button.color = "white";
        } else if (this.gameState.selectedUnit) {
          button.background = "#475569";
          button.color = "#e2e8f0";
        } else {
          button.background = "#1e293b";
          button.color = "#64748b";
        }
      }
    });
  }

  private updateSelectedUnitDisplay(): void {
    const unitDetailsText = this.texts.unitDetails;
    if (unitDetailsText) {
      if (this.gameState.selectedUnit) {
        const unitType = this.unitTypes[this.gameState.selectedUnit.type];
        unitDetailsText.text = 
          `Type: ${unitType.name}\n` +
          `Health: ${this.gameState.selectedUnit.health}%\n` +
          `Supply: ${this.gameState.selectedUnit.supply}%\n` +
          `Status: ${this.gameState.selectedUnit.status}\n` +
          `Position: (${this.gameState.selectedUnit.x}, ${this.gameState.selectedUnit.y}, ${this.gameState.selectedUnit.z})`;
      } else {
        unitDetailsText.text = "No unit selected";
      }
    }
  }

  private updateTimerDisplay(): void {
    if (this.texts.timer) {
      this.texts.timer.text = this.formatTime(this.gameState.turnTimer);
      this.texts.timer.color = this.gameState.turnTimer < 30 ? "#ef4444" : "#10b981";
    }
  }

  private updatePlayerDisplay(): void {
    if (this.texts.player) {
      this.texts.player.text = `Player ${this.gameState.currentPlayer}`;
      this.texts.player.color = this.gameState.currentPlayer === 1 ? "#60a5fa" : "#f87171";
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Public getters for external access
  public getSelectedUnit(): Unit | null {
    return this.gameState.selectedUnit;
  }

  public getActiveAction(): string | null {
    return this.gameState.activeAction;
  }

  public getCurrentPlayer(): number {
    return this.gameState.currentPlayer;
  }

  public getBattlefield(): BattlefieldData {
    return this.battlefield;
  }

  // Public setters for external control
  public setBattlefield(battlefield: BattlefieldData): void {
    this.battlefield = battlefield;
    // Refresh the battlefield display
    this.refreshBattlefieldGrid();
  }

  public updateUnit(unitId: number, updates: Partial<Unit>): void {
    const unit = this.battlefield.units.find(u => u.id === unitId);
    if (unit) {
      Object.assign(unit, updates);
      if (this.gameState.selectedUnit?.id === unitId) {
        this.updateSelectedUnitDisplay();
      }
      this.refreshBattlefieldGrid();
    }
  }

  public addUnit(unit: Unit): void {
    this.battlefield.units.push(unit);
    this.refreshBattlefieldGrid();
  }

  public removeUnit(unitId: number): void {
    this.battlefield.units = this.battlefield.units.filter(u => u.id !== unitId);
    if (this.gameState.selectedUnit?.id === unitId) {
      this.selectUnit(null);
    }
    this.refreshBattlefieldGrid();
  }



  // Cleanup method
  public dispose(): void {
    if (this.advancedTexture) {
      this.advancedTexture.dispose();
    }
  }

  // Event handlers that can be overridden
  public onUnitSelected(unit: Unit | null): void {
    // Override this method to handle unit selection events
    console.log('Unit selected:', unit);
  }

  public onActionExecuted(unit: Unit, action: string, targetX?: number, targetY?: number): void {
    // Override this method to handle action execution events
    console.log('Action executed:', { unit, action, targetX, targetY });
  }

  public onTurnEnded(newPlayer: number): void {
    // Override this method to handle turn end events
    console.log('Turn ended, new player:', newPlayer);
  }

  // Enhanced public methods
  public pauseGame(): void {
    this.gameState.gameState = 'paused';
  }

  public resumeGame(): void {
    this.gameState.gameState = 'active';
  }

  public setTurnTimer(seconds: number): void {
    this.gameState.turnTimer = seconds;
    this.updateTimerDisplay();
  }

  public addCombatLogEntry(message: string): void {
    // Add new log entry (in a real implementation, you'd manage a log array)
    console.log('Combat Log:', message);
  }

  // Smart contract integration helpers
  public async executeSmartContractAction(unit: Unit, action: string, targetX?: number, targetY?: number): Promise<void> {
    try {
      // Call the appropriate smart contract function based on action
      switch (action) {
        case 'move':
          await this.callMoveUnit(unit, targetX!, targetY!);
          break;
        case 'attack':
          await this.callAttackUnit(unit, targetX!, targetY!);
          break;
        case 'defend':
          await this.callDefendUnit(unit);
          break;
        case 'patrol':
          await this.callPatrolUnit(unit, targetX!, targetY!);
          break;
        case 'stealth':
          await this.callStealthUnit(unit);
          break;
        case 'heal':
          await this.callHealUnit(unit, targetX!, targetY!);
          break;
        case 'recon':
          await this.callReconUnit(unit, targetX!, targetY!);
          break;
        case 'boost':
          await this.callBoostUnit(unit, targetX!, targetY!);
          break;
        case 'capture':
          await this.callCaptureFlag(unit, targetX!, targetY!);
          break;
        default:
          console.warn('Unknown action:', action);
      }
      
      this.addCombatLogEntry(`${unit.type} unit executed ${action}`);
      this.setActiveAction(null);
      
    } catch (error) {
      console.error('Error executing smart contract action:', error);
      this.addCombatLogEntry(`Failed to execute ${action}: ${error}`);
    }
  }

  // Smart contract function stubs - implement these with your actual contract calls
  private async callMoveUnit(unit: Unit, x: number, y: number): Promise<void> {
    // Example: await contract.move_unit(gameId, unit.id, unit.type, x, y, z);
    console.log('Move unit contract call:', { unit, x, y });
  }

  private async callAttackUnit(unit: Unit, x: number, y: number): Promise<void> {
    // Example: await contract.attack(gameId, targetPlayerId, unit.id, targetId, attackerUnitType, targetUnitType, x, y, z);
    console.log('Attack unit contract call:', { unit, x, y });
  }

  private async callDefendUnit(unit: Unit): Promise<void> {
    // Example: await contract.defend(gameId, unit.id, unit.type, unit.x, unit.y, unit.z);
    console.log('Defend unit contract call:', { unit });
  }

  private async callPatrolUnit(unit: Unit, x: number, y: number): Promise<void> {
    // Example: await contract.patrol(gameId, unit.id, unit.type, x, y, unit.z);
    console.log('Patrol unit contract call:', { unit, x, y });
  }

  private async callStealthUnit(unit: Unit): Promise<void> {
    // Example: await contract.stealth(gameId, unit.id, unit.type, unit.x, unit.y, unit.z);
    console.log('Stealth unit contract call:', { unit });
  }

  private async callHealUnit(unit: Unit, x: number, y: number): Promise<void> {
    // Example: await contract.heal(gameId, unit.id, unit.type, x, y, unit.z);
    console.log('Heal unit contract call:', { unit, x, y });
  }

  private async callReconUnit(unit: Unit, x: number, y: number): Promise<void> {
    // Example: await contract.recon(gameId, unit.id, unit.type, x, y, unit.z);
    console.log('Recon unit contract call:', { unit, x, y });
  }

  private async callBoostUnit(unit: Unit, x: number, y: number): Promise<void> {
    // Example: await contract.boost(gameId, unit.id, unit.type, x, y, unit.z);
    console.log('Boost unit contract call:', { unit, x, y });
  }

  private async callCaptureFlag(unit: Unit, x: number, y: number): Promise<void> {
    // Example: await contract.capture_flag(gameId, unit.id, unit.type, flagId, x, y, unit.z);
    console.log('Capture flag contract call:', { unit, x, y });
  }

  // Arena management methods
  public async createGame(playerName: string, price: number, penalty: number): Promise<number> {
    // Example: return await arenaContract.create(playerName, price, penalty);
    console.log('Create game:', { playerName, price, penalty });
    return 1; // Mock game ID
  }

  public async joinGame(gameId: number, playerName: string): Promise<void> {
    // Example: await arenaContract.join(gameId, playerName);
    console.log('Join game:', { gameId, playerName });
  }

  public async startGame(gameId: number, roundCount: number): Promise<void> {
    // Example: await arenaContract.start(gameId, roundCount);
    console.log('Start game:', { gameId, roundCount });
  }

  public async deleteGame(gameId: number): Promise<void> {
    // Example: await arenaContract.delete(gameId);
    console.log('Delete game:', { gameId });
  }

  // Advanced battlefield management
  public deployForces(battlefieldId: number, unitType: number, supply: number, x: number, y: number, z: number, terrainNum: number, coverLevel: number, elevation: number): void {
    // Example: await nexusContract.deploy_forces(gameId, battlefieldId, unitType, supply, x, y, z, terrainNum, coverLevel, elevation);
    console.log('Deploy forces:', { battlefieldId, unitType, supply, x, y, z, terrainNum, coverLevel, elevation });
  }

  public forceEndPlayerTurn(): void {
    // Example: await nexusContract.force_end_player_turn(gameId);
    this.endTurn();
  }

  // Utility methods for unit management
  public getUnitAt(x: number, y: number): Unit | null {
    return this.battlefield.units.find(unit => unit.x === x && unit.y === y) || null;
  }

  public getBuildingAt(x: number, y: number): Building | null {
    return this.battlefield.buildings.find(building => building.x === x && building.y === y) || null;
  }

  public getUnitsInRange(x: number, y: number, range: number): Unit[] {
    return this.battlefield.units.filter(unit => {
      const distance = Math.sqrt(Math.pow(unit.x - x, 2) + Math.pow(unit.y - y, 2));
      return distance <= range;
    });
  }

  public validateMove(unit: Unit, targetX: number, targetY: number): boolean {
    // Check if move is valid (within bounds, not occupied, etc.)
    if (targetX < 0 || targetX >= this.battlefield.width || targetY < 0 || targetY >= this.battlefield.height) {
      return false;
    }
    
    // Check if position is occupied
    const occupiedByUnit = this.getUnitAt(targetX, targetY);
    const occupiedByBuilding = this.getBuildingAt(targetX, targetY);
    
    return !occupiedByUnit && !occupiedByBuilding;
  }

  public calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  // Enhanced battlefield grid refresh with animations
  private refreshBattlefieldGrid(): void {
    const battlefieldPanel = this.panels.battlefield;
    if (!battlefieldPanel) return;

    // Remove existing grid
    const oldGrid = battlefieldPanel.getChildByName("gridContainer");
    if (oldGrid) {
      battlefieldPanel.removeControl(oldGrid);
    }
    
    // Recreate grid with current state
    this.createBattlefieldGrid(battlefieldPanel);
  }

  // Network sync methods (for multiplayer)
  public syncGameState(gameState: Partial<GameState>): void {
    Object.assign(this.gameState, gameState);
    this.updateAllDisplays();
  }

  public syncBattlefield(battlefield: BattlefieldData): void {
    this.battlefield = battlefield;
    this.refreshBattlefieldGrid();
  }

  private updateAllDisplays(): void {
    this.updateTimerDisplay();
    this.updatePlayerDisplay();
    this.updateSelectedUnitDisplay();
    this.updateActionButtons();
  }

  // Export game state for saving/loading
  public exportGameState(): { gameState: GameState; battlefield: BattlefieldData } {
    return {
      gameState: { ...this.gameState },
      battlefield: { ...this.battlefield }
    };
  }

  public importGameState(data: { gameState: GameState; battlefield: BattlefieldData }): void {
    this.gameState = { ...data.gameState };
    this.battlefield = { ...data.battlefield };
    this.updateAllDisplays();
    this.refreshBattlefieldGrid();
  }
}

export default CommandNexusGUI;