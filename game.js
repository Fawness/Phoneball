class DeerPinball {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.balls = 3;
        this.gameRunning = false;
        this.isDesktop = window.innerWidth >= 768;
        
        // Game objects
        this.ball = null;
        this.flippers = [];
        this.bumpers = [];
        this.targets = [];
        this.walls = [];
        this.spring = null;
        this.particles = [];
        
        // Input handling
        this.keys = {};
        this.touchStartY = 0;
        this.touchStartX = 0;
        this.leftFlipperPressed = false;
        this.rightFlipperPressed = false;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.createGameObjects();
        this.setupEventListeners();
        this.updateDisplay();
        this.gameLoop();
    }
    
    setupCanvas() {
        // Set canvas size to match container
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight - 120; // Account for header and controls
        
        // Scale for retina displays
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
    }
    
    createGameObjects() {
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        const laneWidth = 40;
        const playfieldMargin = 16;
        const flipperLength = 60;
        const flipperY = canvasHeight - 60;
        const flipperAngle = Math.PI / 6;

        // Ball starts in the launch lane
        this.ball = {
            x: canvasWidth - laneWidth / 2 - playfieldMargin,
            y: canvasHeight - 40,
            radius: 8,
            vx: 0,
            vy: 0,
            gravity: 0.3,
            friction: 0.98,
            color: '#8B4513',
            inLaunchLane: true
        };

        // Flippers at bottom center, angled inward
        this.flippers = [
            {
                x: canvasWidth / 2 - 40,
                y: flipperY,
                width: flipperLength,
                height: 15,
                angle: -flipperAngle,
                maxAngle: -flipperAngle - Math.PI / 6,
                minAngle: -flipperAngle + Math.PI / 8,
                angularVelocity: 0,
                angularAcceleration: 0.8,
                damping: 0.95,
                color: '#654321',
                isPressed: false
            },
            {
                x: canvasWidth / 2 + 40,
                y: flipperY,
                width: flipperLength,
                height: 15,
                angle: flipperAngle,
                maxAngle: flipperAngle + Math.PI / 6,
                minAngle: flipperAngle - Math.PI / 8,
                angularVelocity: 0,
                angularAcceleration: 0.8,
                damping: 0.95,
                color: '#654321',
                isPressed: false
            }
        ];

        // Bumpers and targets repositioned for new playfield
        this.bumpers = [
            { x: canvasWidth / 2, y: canvasHeight * 0.22, radius: 28, color: '#A0522D', emoji: '🦌', points: 150 },
            { x: canvasWidth * 0.32, y: canvasHeight * 0.32, radius: 22, color: '#8B4513', emoji: '🦌', points: 100 },
            { x: canvasWidth * 0.68, y: canvasHeight * 0.32, radius: 22, color: '#8B4513', emoji: '🦌', points: 100 },
            { x: canvasWidth * 0.42, y: canvasHeight * 0.42, radius: 16, color: '#CD853F', emoji: '🍂', points: 75 },
            { x: canvasWidth * 0.58, y: canvasHeight * 0.42, radius: 16, color: '#CD853F', emoji: '🍂', points: 75 }
        ];
        this.targets = [
            { x: canvasWidth * 0.18, y: canvasHeight * 0.55, width: 15, height: 20, hit: false, emoji: '🌰', points: 50 },
            { x: canvasWidth * 0.82, y: canvasHeight * 0.55, width: 15, height: 20, hit: false, emoji: '🌰', points: 50 },
            { x: canvasWidth * 0.18, y: canvasHeight * 0.65, width: 15, height: 20, hit: false, emoji: '🌰', points: 50 },
            { x: canvasWidth * 0.82, y: canvasHeight * 0.65, width: 15, height: 20, hit: false, emoji: '🌰', points: 50 }
        ];

        // Playfield boundaries as a path (rounded top, sloped sides, launch lane)
        this.playfieldPath = new Path2D();
        this.playfieldPath.moveTo(playfieldMargin, canvasHeight - playfieldMargin);
        this.playfieldPath.lineTo(playfieldMargin, 80);
        this.playfieldPath.quadraticCurveTo(
            canvasWidth / 2, playfieldMargin,
            canvasWidth - laneWidth - playfieldMargin, 80
        );
        this.playfieldPath.lineTo(canvasWidth - laneWidth - playfieldMargin, canvasHeight - playfieldMargin);
        this.playfieldPath.closePath();

        // Launch lane path
        this.launchLanePath = new Path2D();
        this.launchLanePath.moveTo(canvasWidth - laneWidth - playfieldMargin, canvasHeight - playfieldMargin);
        this.launchLanePath.lineTo(canvasWidth - laneWidth - playfieldMargin, 80);
        this.launchLanePath.lineTo(canvasWidth - playfieldMargin, 80);
        this.launchLanePath.lineTo(canvasWidth - playfieldMargin, canvasHeight - playfieldMargin);
        this.launchLanePath.closePath();

        // Spring launcher in the launch lane
        this.spring = {
            x: canvasWidth - laneWidth / 2 - playfieldMargin,
            y: canvasHeight - 30,
            width: laneWidth - 12,
            height: 20,
            compressed: false,
            compression: 0,
            maxCompression: 30,
            color: '#654321'
        };
    }
    
    setupEventListeners() {
        // Keyboard controls for desktop
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') {
                e.preventDefault();
                this.launchBall();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        
        // Touch controls for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            
            this.touchStartX = x;
            this.touchStartY = y;
            
            // Check if touch is in left or right half
            const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
            if (x < canvasWidth / 2) {
                this.leftFlipperPressed = true;
            } else {
                this.rightFlipperPressed = true;
            }
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const y = touch.clientY - rect.top;
            
            // Check for swipe down gesture
            if (this.touchStartY - y > 50) {
                this.launchBall();
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.leftFlipperPressed = false;
            this.rightFlipperPressed = false;
        });
        
        // Mouse controls for desktop
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
            
            if (x < canvasWidth / 2) {
                this.leftFlipperPressed = true;
            } else {
                this.rightFlipperPressed = true;
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            this.leftFlipperPressed = false;
            this.rightFlipperPressed = false;
        });
        
        // Restart button
        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restartGame();
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.createGameObjects();
        });
    }
    
    launchBall() {
        if (!this.gameRunning && this.balls > 0) {
            this.gameRunning = true;
            this.ball.vx = (Math.random() - 0.5) * 4;
            this.ball.vy = -15 - Math.random() * 5;
        }
    }
    
    updateFlippers() {
        // Handle input
        if (this.isDesktop) {
            this.flippers[0].isPressed = this.keys['ArrowLeft'] || this.keys['KeyA'];
            this.flippers[1].isPressed = this.keys['ArrowRight'] || this.keys['KeyD'];
        } else {
            this.flippers[0].isPressed = this.leftFlipperPressed;
            this.flippers[1].isPressed = this.rightFlipperPressed;
        }
        
        // Update flipper physics
        this.flippers.forEach(flipper => {
            if (flipper.isPressed) {
                flipper.angularVelocity += flipper.angularAcceleration;
            } else {
                flipper.angularVelocity -= flipper.angularAcceleration;
            }
            
            flipper.angularVelocity *= flipper.damping;
            flipper.angle += flipper.angularVelocity;
            
            // Clamp angle
            if (flipper.angle < flipper.maxAngle) {
                flipper.angle = flipper.maxAngle;
                flipper.angularVelocity = 0;
            } else if (flipper.angle > flipper.minAngle) {
                flipper.angle = flipper.minAngle;
                flipper.angularVelocity = 0;
            }
        });
    }
    
    updateBall() {
        if (!this.gameRunning) return;
        
        // Apply gravity
        this.ball.vy += this.ball.gravity;
        
        // Apply friction
        this.ball.vx *= this.ball.friction;
        this.ball.vy *= this.ball.friction;
        
        // Update position
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;
        
        // Check wall collisions
        this.checkWallCollisions();
        
        // Check flipper collisions
        this.checkFlipperCollisions();
        
        // Check bumper collisions
        this.checkBumperCollisions();
        
        // Check target collisions
        this.checkTargetCollisions();
        
        // Check if ball is lost
        if (this.ball.y > this.canvas.height / (window.devicePixelRatio || 1)) {
            this.loseBall();
        }
    }
    
    checkWallCollisions() {
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        // Left and right walls
        if (this.ball.x - this.ball.radius < 10) {
            this.ball.x = 10 + this.ball.radius;
            this.ball.vx = Math.abs(this.ball.vx) * 0.8;
        }
        if (this.ball.x + this.ball.radius > canvasWidth - 10) {
            this.ball.x = canvasWidth - 10 - this.ball.radius;
            this.ball.vx = -Math.abs(this.ball.vx) * 0.8;
        }
        
        // Top wall
        if (this.ball.y - this.ball.radius < 10) {
            this.ball.y = 10 + this.ball.radius;
            this.ball.vy = Math.abs(this.ball.vy) * 0.8;
        }
    }
    
    checkFlipperCollisions() {
        this.flippers.forEach(flipper => {
            // Simple collision detection with flipper
            const flipperEndX = flipper.x + Math.cos(flipper.angle) * flipper.width;
            const flipperEndY = flipper.y + Math.sin(flipper.angle) * flipper.width;
            
            const dx = this.ball.x - flipper.x;
            const dy = this.ball.y - flipper.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.ball.radius + flipper.width / 2) {
                // Calculate collision response
                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
                
                // Add flipper momentum
                const flipperSpeed = flipper.angularVelocity * flipper.width;
                this.ball.vx += Math.cos(angle) * speed * 0.5 + flipperSpeed * 0.3;
                this.ball.vy += Math.sin(angle) * speed * 0.5;
                
                // Move ball away from flipper
                this.ball.x = flipper.x + Math.cos(angle) * (this.ball.radius + flipper.width / 2);
                this.ball.y = flipper.y + Math.sin(angle) * (this.ball.radius + flipper.width / 2);
            }
        });
    }
    
    checkBumperCollisions() {
        this.bumpers.forEach(bumper => {
            const dx = this.ball.x - bumper.x;
            const dy = this.ball.y - bumper.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.ball.radius + bumper.radius) {
                // Bounce ball away
                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy);
                
                this.ball.vx = Math.cos(angle) * speed * 1.2;
                this.ball.vy = Math.sin(angle) * speed * 1.2;
                
                // Move ball away from bumper
                this.ball.x = bumper.x + Math.cos(angle) * (this.ball.radius + bumper.radius);
                this.ball.y = bumper.y + Math.sin(angle) * (this.ball.radius + bumper.radius);
                
                // Add score and particles
                this.score += bumper.points;
                this.createParticles(bumper.x, bumper.y, bumper.color);
                this.updateDisplay();
            }
        });
    }
    
    checkTargetCollisions() {
        this.targets.forEach(target => {
            if (target.hit) return;
            
            if (this.ball.x > target.x && this.ball.x < target.x + target.width &&
                this.ball.y > target.y && this.ball.y < target.y + target.height) {
                
                target.hit = true;
                this.score += target.points;
                this.createParticles(target.x + target.width/2, target.y + target.height/2, '#8B4513');
                this.updateDisplay();
            }
        });
    }
    
    createParticles(x, y, color) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 30,
                maxLife: 30,
                color: color,
                size: Math.random() * 4 + 2
            });
        }
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.2; // gravity
            particle.life--;
            
            return particle.life > 0;
        });
    }
    
    loseBall() {
        this.balls--;
        this.gameRunning = false;
        this.updateDisplay();
        
        if (this.balls <= 0) {
            this.gameOver();
        } else {
            // Reset ball position
            const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
            const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
            this.ball.x = canvasWidth - 40 / 2 - 16;
            this.ball.y = canvasHeight - 40;
            this.ball.vx = 0;
            this.ball.vy = 0;
        }
    }
    
    gameOver() {
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').style.display = 'flex';
    }
    
    restartGame() {
        this.score = 0;
        this.balls = 3;
        this.gameRunning = false;
        this.particles = [];
        
        // Reset targets
        this.targets.forEach(target => target.hit = false);
        
        // Reset ball
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        this.ball.x = canvasWidth - 40 / 2 - 16;
        this.ball.y = canvasHeight - 40;
        this.ball.vx = 0;
        this.ball.vy = 0;
        
        document.getElementById('gameOver').style.display = 'none';
        this.updateDisplay();
    }
    
    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('balls').textContent = this.balls;
    }
    
    draw() {
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        const playfieldMargin = 16;
        const laneWidth = 40;

        // Clear canvas
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Draw background gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, canvasHeight);
        gradient.addColorStop(0, '#2d5016');
        gradient.addColorStop(0.3, '#4a7c59');
        gradient.addColorStop(1, '#8fbc8f');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Draw playfield boundary
        this.ctx.save();
        this.ctx.shadowColor = '#000';
        this.ctx.shadowBlur = 10;
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#654321';
        this.ctx.fillStyle = '#1a3d0f';
        this.ctx.fill(this.playfieldPath);
        this.ctx.stroke(this.playfieldPath);
        this.ctx.restore();

        // Draw launch lane
        this.ctx.save();
        this.ctx.shadowColor = '#000';
        this.ctx.shadowBlur = 6;
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#654321';
        this.ctx.fillStyle = '#2d5016';
        this.ctx.fill(this.launchLanePath);
        this.ctx.stroke(this.launchLanePath);
        this.ctx.restore();

        // Draw bumpers
        this.bumpers.forEach(bumper => {
            this.ctx.fillStyle = bumper.color;
            this.ctx.beginPath();
            this.ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(bumper.emoji, bumper.x, bumper.y);
        });

        // Draw targets
        this.targets.forEach(target => {
            if (!target.hit) {
                this.ctx.fillStyle = '#8B4513';
                this.ctx.fillRect(target.x, target.y, target.width, target.height);
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(target.emoji, target.x + target.width/2, target.y + target.height/2);
            }
        });

        // Draw flippers
        this.flippers.forEach(flipper => {
            this.ctx.save();
            this.ctx.translate(flipper.x, flipper.y);
            this.ctx.rotate(flipper.angle);
            this.ctx.fillStyle = flipper.color;
            this.ctx.fillRect(0, -flipper.height/2, flipper.width, flipper.height);
            this.ctx.restore();
        });

        // Draw spring in launch lane
        this.ctx.fillStyle = this.spring.color;
        this.ctx.fillRect(
            this.spring.x - this.spring.width/2,
            this.spring.y - this.spring.height/2 + this.spring.compression,
            this.spring.width,
            this.spring.height
        );

        // Draw ball
        this.ctx.fillStyle = this.ball.color;
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw particles
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // Draw deer decorations
        this.drawDeerDecorations();
    }
    
    drawDeerDecorations() {
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        // Draw some forest decorations
        this.ctx.font = '24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Trees in background
        this.ctx.fillText('🌲', canvasWidth * 0.1, canvasHeight * 0.1);
        this.ctx.fillText('🌲', canvasWidth * 0.9, canvasHeight * 0.15);
        this.ctx.fillText('🌲', canvasWidth * 0.05, canvasHeight * 0.2);
        
        // Small deer
        this.ctx.font = '16px Arial';
        this.ctx.fillText('🦌', canvasWidth * 0.15, canvasHeight * 0.8);
        this.ctx.fillText('🦌', canvasWidth * 0.85, canvasHeight * 0.75);
    }
    
    gameLoop() {
        this.updateFlippers();
        this.updateBall();
        this.updateParticles();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    new DeerPinball();
}); 