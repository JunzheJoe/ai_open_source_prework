class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.myPlayerId = null;
        this.myPlayer = null;
        this.allPlayers = {}; // Track all players
        this.avatars = {};
        
        // Viewport
        this.viewportX = 0;
        this.viewportY = 0;
        
        // Movement
        this.activeKeys = new Set();
        this.currentDirection = null;
        
        // WebSocket
        this.ws = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupKeyboardControls();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateViewport();
            this.draw();
        });
        
        // Make canvas focusable for keyboard events
        this.canvas.tabIndex = 0;
        this.canvas.focus();
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    setupKeyboardControls() {
        // Handle keydown events
        document.addEventListener('keydown', (event) => {
            if (this.isArrowKey(event.code)) {
                event.preventDefault(); // Prevent browser default behavior
                this.handleKeyDown(event.code);
            }
        });
        
        // Handle keyup events
        document.addEventListener('keyup', (event) => {
            if (this.isArrowKey(event.code)) {
                event.preventDefault();
                this.handleKeyUp(event.code);
            }
        });
    }
    
    isArrowKey(code) {
        return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code);
    }
    
    getDirectionFromKey(code) {
        const keyToDirection = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        return keyToDirection[code];
    }
    
    handleKeyDown(keyCode) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const direction = this.getDirectionFromKey(keyCode);
        if (direction) {
            this.activeKeys.add(keyCode);
            this.currentDirection = direction;
            this.sendMoveCommand(direction);
        }
    }
    
    handleKeyUp(keyCode) {
        this.activeKeys.delete(keyCode);
        
        // If no keys are pressed, stop movement
        if (this.activeKeys.size === 0) {
            this.currentDirection = null;
            this.sendStopCommand();
        } else {
            // If other keys are still pressed, continue with the most recent direction
            const remainingKeys = Array.from(this.activeKeys);
            const lastKey = remainingKeys[remainingKeys.length - 1];
            this.currentDirection = this.getDirectionFromKey(lastKey);
            this.sendMoveCommand(this.currentDirection);
        }
    }
    
    sendMoveCommand(direction) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        
        this.ws.send(JSON.stringify(moveMessage));
    }
    
    sendStopCommand() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const stopMessage = {
            action: 'stop'
        };
        
        this.ws.send(JSON.stringify(stopMessage));
    }
    
    connectToServer() {
        this.ws = new WebSocket('wss://codepath-mmorg.onrender.com');
        
        this.ws.onopen = () => {
            console.log('Connected to game server');
            this.joinGame();
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleServerMessage(message);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from server');
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                this.connectToServer();
            }, 3000);
        };
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Joe'
        };
        
        this.ws.send(JSON.stringify(joinMessage));
    }
    
    handleServerMessage(message) {
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.avatars = message.avatars;
                    this.allPlayers = message.players; // Store all players
                    this.myPlayer = message.players[this.myPlayerId];
                    this.updateViewport();
                    this.draw();
                    console.log('Joined game successfully!', this.myPlayer);
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'players_moved':
                // Update player positions
                Object.keys(message.players).forEach(playerId => {
                    if (message.players[playerId]) {
                        this.allPlayers[playerId] = message.players[playerId];
                        if (playerId === this.myPlayerId) {
                            this.myPlayer = message.players[playerId];
                            this.updateViewport();
                        }
                    }
                });
                this.draw();
                break;
                
            case 'player_joined':
                // New player joined
                this.allPlayers[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.draw();
                break;
                
            case 'player_left':
                // Player left
                delete this.allPlayers[message.playerId];
                this.draw();
                break;
        }
    }
    
    updateViewport() {
        if (!this.myPlayer) return;
        
        // Calculate viewport to center my avatar
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Calculate desired viewport position to center the avatar
        let newViewportX = this.myPlayer.x - centerX;
        let newViewportY = this.myPlayer.y - centerY;
        
        // Clamp to world boundaries to prevent showing beyond map edges
        newViewportX = Math.max(0, Math.min(newViewportX, this.worldWidth - this.canvas.width));
        newViewportY = Math.max(0, Math.min(newViewportY, this.worldHeight - this.canvas.height));
        
        this.viewportX = newViewportX;
        this.viewportY = newViewportY;
    }
    
    draw() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.viewportX, this.viewportY, this.canvas.width, this.canvas.height,  // source rectangle (viewport)
            0, 0, this.canvas.width, this.canvas.height  // destination rectangle (full canvas)
        );
        
        // Draw all players except myself
        Object.values(this.allPlayers).forEach(player => {
            // Only draw other players, not myself
            if (player.id !== this.myPlayerId && this.avatars[player.avatar]) {
                this.drawAvatar(player, this.avatars[player.avatar]);
            }
        });
        
        // Draw my avatar separately (this ensures we only see one Joe)
        if (this.myPlayer && this.avatars[this.myPlayer.avatar]) {
            this.drawAvatar(this.myPlayer, this.avatars[this.myPlayer.avatar]);
        }
    }
    
    drawAvatar(player, avatarData) {
        // Calculate avatar position relative to viewport
        const avatarX = player.x - this.viewportX;
        const avatarY = player.y - this.viewportY;
        
        // Only draw if avatar is within viewport
        if (avatarX < -50 || avatarX > this.canvas.width + 50 || 
            avatarY < -50 || avatarY > this.canvas.height + 50) {
            return;
        }
        
        // Get the appropriate avatar frame
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        
        let frames = avatarData.frames[direction];
        if (direction === 'west') {
            // Use east frames flipped for west direction
            frames = avatarData.frames.east;
        }
        
        if (frames && frames[frameIndex]) {
            const avatarImg = new Image();
            avatarImg.onload = () => {
                // Calculate avatar size (maintain aspect ratio)
                const maxSize = 32;
                const aspectRatio = avatarImg.width / avatarImg.height;
                let avatarWidth = maxSize;
                let avatarHeight = maxSize / aspectRatio;
                
                if (aspectRatio < 1) {
                    avatarHeight = maxSize;
                    avatarWidth = maxSize * aspectRatio;
                }
                
                // Draw avatar
                this.ctx.save();
                
                if (direction === 'west') {
                    // Flip horizontally for west direction
                    this.ctx.scale(-1, 1);
                    this.ctx.drawImage(
                        avatarImg,
                        -avatarX - avatarWidth/2, avatarY - avatarHeight/2,
                        avatarWidth, avatarHeight
                    );
                } else {
                    this.ctx.drawImage(
                        avatarImg,
                        avatarX - avatarWidth/2, avatarY - avatarHeight/2,
                        avatarWidth, avatarHeight
                    );
                }
                
                this.ctx.restore();
                
                // Draw username label
                this.ctx.fillStyle = 'white';
                this.ctx.strokeStyle = 'black';
                this.ctx.lineWidth = 2;
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                
                const labelY = avatarY - avatarHeight/2 - 5;
                this.ctx.strokeText(player.username, avatarX, labelY);
                this.ctx.fillText(player.username, avatarX, labelY);
            };
            avatarImg.src = frames[frameIndex];
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
