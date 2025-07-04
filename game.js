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
        const funnelHeight = 90;
        const flipperLength = Math.max(60, canvasWidth * 0.18);
        const flipperGap = Math.max(10, canvasWidth * 0.025);
        const outlaneWidth = Math.max(36, canvasWidth * 0.08);
        const bottomWallY = canvasHeight - playfieldMargin;
        const drainRadius = Math.max(32, canvasWidth * 0.08);
        const flipperTipY = canvasHeight - 32 - canvasHeight * 0.10;
        const flipperBaseY = bottomWallY - 18 - canvasHeight * 0.10;
        const flipperBaseX_L = playfieldMargin + outlaneWidth + 18;
        const flipperBaseX_R = canvasWidth - laneWidth - playfieldMargin - outlaneWidth - 18;
        const flipperTipX_L = canvasWidth / 2 - flipperGap / 2;
        const flipperTipX_R = canvasWidth / 2 + flipperGap / 2;
        // Flipper geometry as single source of truth
        this.flipperGeom = [
            {
                base: { x: flipperBaseX_L, y: flipperBaseY },
                tip: { x: flipperTipX_L, y: flipperTipY },
                length: flipperLength
            },
            {
                base: { x: flipperBaseX_R, y: flipperBaseY },
                tip: { x: flipperTipX_R, y: flipperTipY },
                length: flipperLength
            }
        ];
        // Calculate angle from base to tip for each flipper
        const leftAngle = Math.atan2(flipperTipY - flipperBaseY, flipperTipX_L - flipperBaseX_L);
        const rightAngle = Math.atan2(flipperTipY - flipperBaseY, flipperTipX_R - flipperBaseX_R);

        // Ball starts in the launch lane
        this.ball = {
            x: canvasWidth - laneWidth / 2 - playfieldMargin,
            y: canvasHeight - 40,
            radius: Math.max(8, canvasWidth * 0.018),
            vx: 0,
            vy: 0,
            gravity: 0.3,
            friction: 0.98,
            color: '#8B4513',
            inLaunchLane: true
        };

        // Flippers: use geometry for both drawing and collision
        this.flippers = [
            {
                x: this.flipperGeom[0].base.x,
                y: this.flipperGeom[0].base.y,
                width: flipperLength,
                height: 15,
                angle: leftAngle,
                maxAngle: leftAngle + Math.PI / 8,
                minAngle: leftAngle - Math.PI / 8,
                angularVelocity: 0,
                angularAcceleration: 0.8,
                damping: 0.95,
                color: '#228B22',
                isPressed: false,
                tipX: this.flipperGeom[0].tip.x,
                tipY: this.flipperGeom[0].tip.y
            },
            {
                x: this.flipperGeom[1].base.x,
                y: this.flipperGeom[1].base.y,
                width: flipperLength,
                height: 15,
                angle: rightAngle,
                maxAngle: rightAngle - Math.PI / 8,
                minAngle: rightAngle + Math.PI / 8,
                angularVelocity: 0,
                angularAcceleration: 0.8,
                damping: 0.95,
                color: '#228B22',
                isPressed: false,
                tipX: this.flipperGeom[1].tip.x,
                tipY: this.flipperGeom[1].tip.y
            }
        ];

        // Bumpers and pegs (unchanged)
        this.bumpers = [
            { x: canvasWidth * 0.32, y: canvasHeight * 0.22, radius: Math.max(18, canvasWidth * 0.04), color: '#8B4513', emoji: '🦌', points: 100 },
            { x: canvasWidth * 0.68, y: canvasHeight * 0.22, radius: Math.max(18, canvasWidth * 0.04), color: '#8B4513', emoji: '🦌', points: 100 },
            { x: canvasWidth * 0.5, y: canvasHeight * 0.16, radius: Math.max(22, canvasWidth * 0.05), color: '#A0522D', emoji: '🦌', points: 150 },
            { x: canvasWidth * 0.4, y: canvasHeight * 0.32, radius: Math.max(10, canvasWidth * 0.025), color: '#8B4513', emoji: '🌲', points: 60 },
            { x: canvasWidth * 0.6, y: canvasHeight * 0.32, radius: Math.max(10, canvasWidth * 0.025), color: '#8B4513', emoji: '🌲', points: 60 },
            { x: canvasWidth * 0.3, y: canvasHeight * 0.45, radius: Math.max(8, canvasWidth * 0.02), color: '#A0522D', emoji: '🌰', points: 50 },
            { x: canvasWidth * 0.7, y: canvasHeight * 0.45, radius: Math.max(8, canvasWidth * 0.02), color: '#A0522D', emoji: '🌰', points: 50 }
        ];
        this.targets = [
            { x: canvasWidth * 0.18, y: canvasHeight * 0.55, width: 15, height: 20, hit: false, emoji: '🌰', points: 50 },
            { x: canvasWidth * 0.82, y: canvasHeight * 0.55, width: 15, height: 20, hit: false, emoji: '🌰', points: 50 }
        ];

        // Playfield boundaries as a path (rounded top, sloped sides, classic U drain)
        this.playfieldPath = new Path2D();
        // Start at left outlane
        this.playfieldPath.moveTo(playfieldMargin + outlaneWidth, bottomWallY - funnelHeight / 2);
        // Left funnel curve
        this.playfieldPath.bezierCurveTo(
            playfieldMargin + 8, canvasHeight - funnelHeight * 0.7,
            playfieldMargin, canvasHeight - funnelHeight * 1.1,
            playfieldMargin, canvasHeight - funnelHeight - 60
        );
        // Left side up to top
        this.playfieldPath.lineTo(playfieldMargin, 80);
        this.playfieldPath.quadraticCurveTo(
            canvasWidth / 2, playfieldMargin,
            canvasWidth - laneWidth - playfieldMargin, 80
        );
        // Right side down to funnel
        this.playfieldPath.lineTo(canvasWidth - laneWidth - playfieldMargin, canvasHeight - funnelHeight - 60);
        this.playfieldPath.bezierCurveTo(
            canvasWidth - laneWidth - playfieldMargin, canvasHeight - funnelHeight * 1.1,
            canvasWidth - laneWidth - playfieldMargin + 8, canvasHeight - funnelHeight * 0.7,
            canvasWidth - laneWidth - playfieldMargin + outlaneWidth, bottomWallY - funnelHeight / 2
        );
        // Wall guide to right flipper base
        this.playfieldPath.lineTo(flipperBaseX_R, flipperBaseY);
        // U-shaped drain
        this.playfieldPath.arc(
            canvasWidth / 2, flipperTipY + drainRadius / 2, drainRadius, 0.15 * Math.PI, 0.85 * Math.PI, true
        );
        // Wall guide to left flipper base
        this.playfieldPath.lineTo(flipperBaseX_L, flipperBaseY);
        this.playfieldPath.closePath();

        // Internal sloped/angled walls for interesting gameplay (all slope inward, mirrored)
        this.internalWalls = [
            // Left lower guide (slopes inward)
            [
                { x: playfieldMargin + outlaneWidth + 10, y: bottomWallY - funnelHeight / 2 - 10 },
                { x: canvasWidth / 2 - 60, y: canvasHeight * 0.7 - canvasHeight * 0.10 }
            ],
            // Right lower guide (slopes inward)
            [
                { x: canvasWidth - laneWidth - playfieldMargin - outlaneWidth - 10, y: bottomWallY - funnelHeight / 2 - 10 },
                { x: canvasWidth / 2 + 60, y: canvasHeight * 0.7 - canvasHeight * 0.10 }
            ],
            // Mid left angled wall (slopes inward)
            [
                { x: playfieldMargin + 30, y: canvasHeight * 0.45 },
                { x: canvasWidth / 2 - 80, y: canvasHeight * 0.25 }
            ],
            // Mid right angled wall (slopes inward)
            [
                { x: canvasWidth - laneWidth - playfieldMargin - 30, y: canvasHeight * 0.45 },
                { x: canvasWidth / 2 + 80, y: canvasHeight * 0.25 }
            ]
        ];

        // Launch lane path (unchanged)
        this.launchLanePath = new Path2D();
        this.launchLanePath.moveTo(canvasWidth - laneWidth - playfieldMargin, bottomWallY);
        this.launchLanePath.lineTo(canvasWidth - laneWidth - playfieldMargin, 80);
        this.launchLanePath.lineTo(canvasWidth - playfieldMargin, 80);
        this.launchLanePath.lineTo(canvasWidth - playfieldMargin, bottomWallY);
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
        if (!this.gameRunning && this.balls > 0 && this.ball.inLaunchLane) {
            this.gameRunning = true;
            this.ball.launching = true;
            this.ball.launchProgress = 0;
            this.ball.vx = 0;
            this.ball.vy = -18 - Math.random() * 4;
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

        // If launching from the lane, animate up and around the curve
        if (this.ball.launching) {
            const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
            const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
            const playfieldMargin = 16;
            const laneWidth = 40;
            const curveRadius = 48;
            // Move up the launch lane
            if (this.ball.y > 80 + curveRadius && !this.ball.curving) {
                this.ball.y += this.ball.vy;
                // Keep ball in the center of the launch lane
                this.ball.x = canvasWidth - laneWidth / 2 - playfieldMargin;
            } else {
                // Animate along the curve into the playfield
                this.ball.curving = true;
                if (!this.ball.curveAngle) this.ball.curveAngle = Math.PI / 2;
                // Curve center
                const cx = canvasWidth - laneWidth - playfieldMargin + curveRadius;
                const cy = 80 + curveRadius;
                // Move along the curve
                this.ball.curveAngle -= 0.06;
                this.ball.x = cx + Math.cos(this.ball.curveAngle) * curveRadius;
                this.ball.y = cy - Math.sin(this.ball.curveAngle) * curveRadius;
                if (this.ball.curveAngle <= 0) {
                    // Enter playfield at the top
                    this.ball.launching = false;
                    this.ball.curving = false;
                    this.ball.curveAngle = undefined;
                    this.ball.inLaunchLane = false;
                    this.ball.x = canvasWidth - laneWidth - playfieldMargin - this.ball.radius - 2;
                    this.ball.y = 80 + this.ball.radius + 2;
                    this.ball.vx = -4 + Math.random() * 2;
                    this.ball.vy = 2 + Math.random() * 2;
                }
            }
            return;
        }

        // Normal playfield physics
        this.ball.vy += this.ball.gravity;
        this.ball.vx *= this.ball.friction;
        this.ball.vy *= this.ball.friction;
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        // Wall collision for playfield
        this.checkPlayfieldCollisions();
        // Internal wall collision
        this.checkInternalWallCollisions();
        this.checkFlipperCollisions();
        this.checkBumperCollisions();
        this.checkTargetCollisions();
        if (this.ball.y > this.canvas.height / (window.devicePixelRatio || 1)) {
            this.loseBall();
        }
    }
    
    checkPlayfieldCollisions() {
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        const playfieldMargin = 16;
        const laneWidth = 40;
        const outlaneWidth = 36;
        const funnelHeight = 80;
        const bottomWallY = canvasHeight - playfieldMargin;
        const drainRadius = 28;
        const flipperTipY = canvasHeight - 32;
        // Left wall
        if (this.ball.x - this.ball.radius < playfieldMargin) {
            this.ball.x = playfieldMargin + this.ball.radius;
            this.ball.vx = Math.abs(this.ball.vx) * 0.8;
        }
        // Right wall (playfield)
        if (!this.ball.inLaunchLane && this.ball.x + this.ball.radius > canvasWidth - laneWidth - playfieldMargin) {
            this.ball.x = canvasWidth - laneWidth - playfieldMargin - this.ball.radius;
            this.ball.vx = -Math.abs(this.ball.vx) * 0.8;
        }
        // Top wall
        if (this.ball.y - this.ball.radius < playfieldMargin + 8) {
            this.ball.y = playfieldMargin + 8 + this.ball.radius;
            this.ball.vy = Math.abs(this.ball.vy) * 0.8;
        }
        // Outlane left slope
        if (
            this.ball.y > bottomWallY - funnelHeight / 2 - 10 &&
            this.ball.x < playfieldMargin + outlaneWidth &&
            this.ball.y < bottomWallY - 10
        ) {
            // Reflect off left outlane
            this.ball.vx = Math.abs(this.ball.vx) * 0.8;
            this.ball.x = playfieldMargin + outlaneWidth + this.ball.radius;
        }
        // Outlane right slope
        if (
            this.ball.y > bottomWallY - funnelHeight / 2 - 10 &&
            this.ball.x > canvasWidth - laneWidth - playfieldMargin - outlaneWidth &&
            this.ball.x < canvasWidth - laneWidth - playfieldMargin &&
            this.ball.y < bottomWallY - 10
        ) {
            // Reflect off right outlane
            this.ball.vx = -Math.abs(this.ball.vx) * 0.8;
            this.ball.x = canvasWidth - laneWidth - playfieldMargin - outlaneWidth - this.ball.radius;
        }
        // Launch lane left wall
        if (this.ball.inLaunchLane && this.ball.x - this.ball.radius < canvasWidth - laneWidth - playfieldMargin + 8) {
            this.ball.x = canvasWidth - laneWidth - playfieldMargin + 8 + this.ball.radius;
            this.ball.vx = Math.abs(this.ball.vx) * 0.8;
        }
        // Launch lane right wall
        if (this.ball.inLaunchLane && this.ball.x + this.ball.radius > canvasWidth - playfieldMargin - 8) {
            this.ball.x = canvasWidth - playfieldMargin - 8 - this.ball.radius;
            this.ball.vx = -Math.abs(this.ball.vx) * 0.8;
        }
        // Drain: lose ball if it falls into the blue arc (center funnel)
        const dx = this.ball.x - canvasWidth / 2;
        const dy = this.ball.y - flipperTipY;
        if (dy > 0 && Math.sqrt(dx * dx + dy * dy) < drainRadius - 2) {
            this.loseBall();
        }
        // Otherwise, reflect off bottom wall
        if (this.ball.y + this.ball.radius > bottomWallY &&
            (this.ball.x <= playfieldMargin + outlaneWidth || this.ball.x >= canvasWidth - laneWidth - playfieldMargin - outlaneWidth)) {
            this.ball.y = bottomWallY - this.ball.radius;
            this.ball.vy = -Math.abs(this.ball.vy) * 0.8;
        }
    }
    
    checkInternalWallCollisions() {
        if (!this.internalWalls) return;
        for (const wall of this.internalWalls) {
            const x1 = wall[0].x, y1 = wall[0].y;
            const x2 = wall[1].x, y2 = wall[1].y;
            // Closest point on line segment to ball
            const dx = x2 - x1;
            const dy = y2 - y1;
            const lengthSq = dx * dx + dy * dy;
            let t = ((this.ball.x - x1) * dx + (this.ball.y - y1) * dy) / lengthSq;
            t = Math.max(0, Math.min(1, t));
            const closestX = x1 + t * dx;
            const closestY = y1 + t * dy;
            const dist = Math.hypot(this.ball.x - closestX, this.ball.y - closestY);
            if (dist < this.ball.radius + 3) {
                // Reflect ball
                const nx = (this.ball.x - closestX) / dist;
                const ny = (this.ball.y - closestY) / dist;
                const dot = this.ball.vx * nx + this.ball.vy * ny;
                this.ball.vx -= 2 * dot * nx;
                this.ball.vy -= 2 * dot * ny;
                // Move ball out of wall
                this.ball.x = closestX + nx * (this.ball.radius + 3);
                this.ball.y = closestY + ny * (this.ball.radius + 3);
            }
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
            // Reset ball to launch lane
            const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
            const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
            const laneWidth = 40;
            const playfieldMargin = 16;
            this.ball.x = canvasWidth - laneWidth / 2 - playfieldMargin;
            this.ball.y = canvasHeight - 40;
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.ball.inLaunchLane = true;
            this.ball.launching = false;
            this.ball.curving = false;
            this.ball.curveAngle = undefined;
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
        this.targets.forEach(target => target.hit = false);
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        const laneWidth = 40;
        const playfieldMargin = 16;
        this.ball.x = canvasWidth - laneWidth / 2 - playfieldMargin;
        this.ball.y = canvasHeight - 40;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.inLaunchLane = true;
        this.ball.launching = false;
        this.ball.curving = false;
        this.ball.curveAngle = undefined;
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

        // Draw internal walls/guides
        this.ctx.save();
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 6;
        this.internalWalls.forEach(wall => {
            this.ctx.beginPath();
            this.ctx.moveTo(wall[0].x, wall[0].y);
            this.ctx.lineTo(wall[1].x, wall[1].y);
            this.ctx.stroke();
        });
        this.ctx.restore();

        // Debug overlay: draw flipper collision lines
        if (window.DEBUG_PINBALL) {
            this.ctx.save();
            this.ctx.strokeStyle = '#00f';
            this.ctx.lineWidth = 3;
            this.flipperGeom.forEach(flip => {
                this.ctx.beginPath();
                this.ctx.moveTo(flip.base.x, flip.base.y);
                this.ctx.lineTo(flip.tip.x, flip.tip.y);
                this.ctx.stroke();
            });
            // Draw internal wall collision lines
            this.ctx.strokeStyle = '#f0f';
            this.internalWalls.forEach(wall => {
                this.ctx.beginPath();
                this.ctx.moveTo(wall[0].x, wall[0].y);
                this.ctx.lineTo(wall[1].x, wall[1].y);
                this.ctx.stroke();
            });
            this.ctx.restore();
        }

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