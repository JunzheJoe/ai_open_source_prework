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
        this.avatars = {};
        
        // Viewport
        this.viewportX = 0;
        this.viewportY = 0;
        
        // WebSocket
        this.ws = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
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
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
        };
        this.worldImage.src = 'world.jpg';
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
                this.avatars[message.avatar.name] = message.avatar;
                this.draw();
                break;
                
            case 'player_left':
                // Player left
                this.draw();
                break;
        }
    }
    
    updateViewport() {
        if (!this.myPlayer) return;
        
        // Calculate viewport to center my avatar
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Calculate desired viewport position
        let newViewportX = this.myPlayer.x - centerX;
        let newViewportY = this.myPlayer.y - centerY;
        
        // Clamp to world boundaries
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
        
        // Draw my avatar if I have one
        if (this.myPlayer && this.avatars[this.myPlayer.avatar]) {
            this.drawAvatar(this.myPlayer, this.avatars[this.myPlayer.avatar]);
        }
    }
    
    drawAvatar(player, avatarData) {
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
