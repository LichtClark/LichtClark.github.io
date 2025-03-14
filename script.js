// Menu functionality
function toggleMenu() {
    const body = document.body;
    const menuContainer = document.getElementById("menuContainer");

    body.classList.toggle('menu-hidden');
    if (body.classList.contains('menu-hidden')) {
        menuContainer.style.left = "-250px"; // Slide the menu off-screen
    } else {
        menuContainer.style.left = "0"; // Slide the menu in
    }
}

// Privacy overlay functionality
document.addEventListener('DOMContentLoaded', function() {
    const overlay = document.getElementById('privacyOverlay');
    const checkbox = document.getElementById('privacyConsent');
    const confirmButton = document.getElementById('confirmButton');
    const webrtcLink = document.getElementById('webrtcLink');
    
    // Initially hide the overlay
    overlay.style.display = 'none';
    
    // Variable to track if the overlay has been shown before
    let overlayShown = false;
    
    // Function to show the overlay when the link is clicked
    webrtcLink.addEventListener('click', function() {
        if (!overlayShown) {
            // Show the overlay only when clicked for the first time
            overlay.style.display = 'flex';
            overlayShown = true;
        }
    });
    
    // Enable or disable confirm button based on checkbox
    checkbox.addEventListener('change', function() {
        confirmButton.disabled = !checkbox.checked;
    });
    
    // Function to hide the overlay and redirect after confirmation
    confirmButton.addEventListener('click', function() {
        // Hide the overlay
        overlay.style.display = 'none';
        // Redirect to the WebRTC page
        window.location.href = './webrtc/';
    });
});

// User-initiated audio playback
document.addEventListener('DOMContentLoaded', function() {
    let audioInitialized = false;
    
    // Function to initialize audio
    function initAudio() {
        if (audioInitialized) return;
        
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioElement = new Audio('./music/b.mp3');
            audioElement.loop = true;
            audioElement.volume = 0.5;
            
            // Create audio source
            const source = audioCtx.createMediaElementSource(audioElement);
            source.connect(audioCtx.destination);
            
            // Play audio
            audioElement.play()
                .then(() => {
                    console.log('Audio playback started');
                    audioInitialized = true;
                })
                .catch(err => {
                    console.error('Audio playback failed:', err);
                });
        } catch (err) {
            console.error('Audio initialization failed:', err);
        }
    }
    
    // Start audio on user interaction
    document.addEventListener('click', initAudio, { once: true });
});

// Canvas animation
(function() {
    const canvas = document.getElementById('animationCanvas');
    const ctx = canvas.getContext('2d');
    let dots = [];
    let triangles = []; // Array to store triangles
    let mouseX = 0;
    let mouseY = 0;
    const mouseRadius = cmToPixels(5); // Convert 5 cm to pixels
    const blurRadius = cmToPixels(1); // Blur radius in pixels
    let isHovered = false; // Flag to check if mouse is within radius
    let animationFrameId = null;
    let lastTriangleUpdate = 0;
    const throttleTime = 100; // ms between triangle updates

    // Initialize canvas
    function initCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        generateDots();
    }

    // Generate dots based on window size
    function generateDots() {
        const numDots = Math.round((canvas.width * canvas.height) / 25000); // Adjust this factor as needed
        dots = []; // Reset dots array
        for (let i = 0; i < numDots; i++) {
            dots.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: Math.random() * 0.2 - 0.1,
                vy: Math.random() * 0.2 - 0.1,
                radius: Math.random() * 3 + 1 // Random radius between 1 and 4
            });
        }
    }

    // Draw dots
    function drawDots() {
        ctx.fillStyle = '#fff';
        for (let dot of dots) {
            const distance = Math.hypot(dot.x - mouseX, dot.y - mouseY);
            const alpha = distance <= mouseRadius ? 1 : Math.max(0, 1 - (distance - mouseRadius) / blurRadius);
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // Draw triangles
    function drawTriangles() {
        if (isHovered && triangles.length > 0) {
            for (let triangle of triangles) {
                let maxDistance = 0;
                for (let point of triangle) {
                    const distance = Math.hypot(point.x - mouseX, point.y - mouseY);
                    if (distance > maxDistance) {
                        maxDistance = distance;
                    }
                }
                
                const distance = Math.min(
                    Math.hypot(triangle[0].x - mouseX, triangle[0].y - mouseY),
                    Math.hypot(triangle[1].x - mouseX, triangle[1].y - mouseY),
                    Math.hypot(triangle[2].x - mouseX, triangle[2].y - mouseY)
                );
                
                const alpha = Math.max(0, 1 - (distance - mouseRadius) / blurRadius);
                const interpolatedAlpha = alpha * (1 - (distance / maxDistance)) * 0.05; // Adjust the multiplier for transparency
                
                ctx.fillStyle = `rgba(255, 255, 255, ${interpolatedAlpha})`;
                ctx.beginPath();
                ctx.moveTo(triangle[0].x, triangle[0].y);
                ctx.lineTo(triangle[1].x, triangle[1].y);
                ctx.lineTo(triangle[2].x, triangle[2].y);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    // Update dots positions
    function updateDots() {
        for (let dot of dots) {
            dot.x += dot.vx;
            dot.y += dot.vy;
            
            // Bounce off walls
            if (dot.x < 0 || dot.x > canvas.width) dot.vx *= -1;
            if (dot.y < 0 || dot.y > canvas.height) dot.vy *= -1;
        }
    }

    // Detect triangles within mouse radius - optimized version
    function detectTriangles() {
        const now = Date.now();
        if (!isHovered || now - lastTriangleUpdate < throttleTime) return;
        
        lastTriangleUpdate = now;
        
        // Find dots within radius first
        const dotsInRadius = dots.filter(dot => isInRadius(dot, mouseX, mouseY));
        
        // Only process if we have enough dots for at least one triangle
        if (dotsInRadius.length < 3) {
            triangles = [];
            return;
        }
        
        triangles = [];
        const maxTriangles = 50; // Limit the number of triangles for performance
        
        // Use a more efficient algorithm for triangle detection
        for (let i = 0; i < dotsInRadius.length && triangles.length < maxTriangles; i++) {
            for (let j = i + 1; j < dotsInRadius.length && triangles.length < maxTriangles; j++) {
                for (let k = j + 1; k < dotsInRadius.length && triangles.length < maxTriangles; k++) {
                    triangles.push([dotsInRadius[i], dotsInRadius[j], dotsInRadius[k]]);
                }
            }
        }
    }

    // Function to check if a point is within the mouse radius
    function isInRadius(point, x, y) {
        const distance = Math.hypot(point.x - x, point.y - y);
        return distance <= mouseRadius;
    }

    // Function to convert centimeters to pixels
    function cmToPixels(cm) {
        // Assuming 1cm = 37.8 pixels (standard DPI for most screens)
        return cm * 37.8;
    }

    // Clear canvas
    function clearCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Animation loop
    function animate() {
        clearCanvas();
        updateDots();
        detectTriangles();
        drawTriangles();
        drawDots();
        animationFrameId = requestAnimationFrame(animate);
    }

    // Mouse move event handler
    canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        isHovered = true;
    });

    // Mouse leave event handler
    canvas.addEventListener('mouseleave', () => {
        isHovered = false;
        triangles = [];
    });

    // Utility function to limit how often a function can run
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }

    // Window resize event handler with debounce
    window.addEventListener('resize', debounce(() => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        initCanvas();
        animationFrameId = requestAnimationFrame(animate);
    }, 250));

    // Initialize and start animation
    initCanvas();
    animate();
})();
