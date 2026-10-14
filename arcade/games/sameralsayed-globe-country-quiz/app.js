(function () {
  const ROUND_TIME = 45;
  const state = {
    score: 0,
    streak: 0,
    bestStreak: 0,
    round: 1,
    correct: 0,
    wrong: 0,
    hintsUsed: 0,
    timeLeft: ROUND_TIME,
    timerId: null,
    currentCountry: null,
    usedCountries: [],
    autoRotate: true
  };

  let scene;
  let camera;
  let renderer;
  let controls;
  let globe;
  let atmosphere;
  let markerGroup;
  let marker;
  let pulseRing;
  let starField;

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function createGlobeTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#1a2f5a");
    gradient.addColorStop(0.5, "#18426a");
    gradient.addColorStop(1, "#0f2346");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const landColor = "rgba(107, 201, 143, 0.88)";
    ctx.fillStyle = landColor;

    const landShapes = [
      [180, 180, 380, 260],
      [500, 120, 250, 180],
      [620, 390, 280, 220],
      [940, 130, 420, 220],
      [1120, 320, 280, 170],
      [1350, 460, 200, 160],
      [1530, 170, 320, 190]
    ];

    landShapes.forEach(function (shape, index) {
      const [x, y, w, h] = shape;
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, h / 2, index * 0.35, 0, Math.PI * 2);
      ctx.fill();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    return texture;
  }

  function initScene() {
    const container = document.getElementById("globeCanvas");
    const width = container.clientWidth;
    const height = container.clientHeight;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b1020, 12, 26);

    camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 0, 6.6);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x8ecbff, 1.2);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(6, 4, 8);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x59d8ff, 2.1, 50);
    rimLight.position.set(-8, -3, 5);
    scene.add(rimLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.8;
    controls.rotateSpeed = 0.45;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const globeGeometry = new THREE.SphereGeometry(2.05, 72, 72);
    const globeMaterial = new THREE.MeshStandardMaterial({
      map: createGlobeTexture(),
      roughness: 0.85,
      metalness: 0.08
    });
    globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);

    const atmosphereGeometry = new THREE.SphereGeometry(2.18, 72, 72);
    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x59d8ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide
    });
    atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 1500;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 120;
      positions[i + 1] = (Math.random() - 0.5) * 120;
      positions[i + 2] = (Math.random() - 0.5) * 120;
    }

    starsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      transparent: true,
      opacity: 0.9
    });
    starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    markerGroup = new THREE.Group();
    scene.add(markerGroup);

    const markerGeometry = new THREE.SphereGeometry(0.09, 24, 24);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffd96a });
    marker = new THREE.Mesh(markerGeometry, markerMaterial);
    markerGroup.add(marker);

    const ringGeometry = new THREE.RingGeometry(0.15, 0.22, 48);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8a5b,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    pulseRing = new THREE.Mesh(ringGeometry, ringMaterial);
    markerGroup.add(pulseRing);

    window.addEventListener("resize", onResize);
    animate();
  }

  function animate() {
    requestAnimationFrame(animate);

    if (state.autoRotate) {
      globe.rotation.y += 0.0018;
      atmosphere.rotation.y += 0.0014;
    }

    if (markerGroup) {
      const scale = 1 + Math.sin(Date.now() * 0.005) * 0.12;
      pulseRing.scale.set(scale, scale, scale);
      pulseRing.material.opacity = 0.65 + Math.sin(Date.now() * 0.004) * 0.2;
    }

    starField.rotation.y += 0.00015;
    controls.update();
    renderer.render(scene, camera);
  }

  function onResize() {
    const container = document.getElementById("globeCanvas");
    if (!renderer || !container) {
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function chooseCountry() {
    if (state.usedCountries.length === window.COUNTRY_QUIZ_DATA.length) {
      state.usedCountries = [];
    }

    const remaining = window.COUNTRY_QUIZ_DATA.filter(function (country) {
      return !state.usedCountries.includes(country.name);
    });

    const next = remaining[Math.floor(Math.random() * remaining.length)];
    state.currentCountry = next;
    state.usedCountries.push(next.name);
    state.hintsUsed = 0;
    state.timeLeft = ROUND_TIME;
    $("#hintCount").text("0");
    $("#hintList").html("<li>Hints will appear here when you request them.</li>");
    $("#targetRegion").text(next.continent);
    $("#guessInput").val("").trigger("focus");
    setMessage("Look at the highlighted location and type the country name.", "info");
    updateTimerUI();
    updateMarker(next);
  }

  function updateMarker(country) {
    const position = latLonToVector3(country.lat, country.lon, 2.07);
    markerGroup.position.copy(position);
    marker.position.set(0, 0, 0);
    pulseRing.position.set(0, 0, 0);
    markerGroup.lookAt(new THREE.Vector3(0, 0, 0));
  }

  function setMessage(text, type) {
    $("#messageBox")
      .removeClass("success error info")
      .addClass(type || "info")
      .text(text);
  }

  function updateStats() {
    $("#scoreValue").text(String(state.score));
    $("#streakValue").text(String(state.streak));
    $("#bestStreakValue").text(String(state.bestStreak));
    $("#roundValue").text(String(state.round));
    $("#correctValue").text(String(state.correct));
    $("#wrongValue").text(String(state.wrong));

    const attempts = state.correct + state.wrong;
    const accuracy = attempts ? Math.round((state.correct / attempts) * 100) : 0;
    $("#accuracyValue").text(String(accuracy) + "%");
  }

  function updateTimerUI() {
    $("#timerValue").text(String(state.timeLeft) + "s");
  }

  function recordHistory(text, status) {
    const item = $('<div class="history-item"></div>').addClass(status || "neutral").text(text);
    const $list = $("#historyList");
    if ($list.find(".history-item.neutral").length) {
      $list.empty();
    }
    $list.prepend(item);
    const items = $list.children(".history-item");
    if (items.length > 6) {
      items.last().remove();
    }
  }

  function useHint() {
    if (!state.currentCountry) {
      return;
    }

    if (state.hintsUsed >= 2) {
      setMessage("You already used both hints for this round.", "error");
      return;
    }

    state.hintsUsed += 1;
    $("#hintCount").text(String(state.hintsUsed));

    const hints = [];
    hints.push("Continent: " + state.currentCountry.continent);
    hints.push("Starts with: " + state.currentCountry.name.charAt(0));
    hints.push("Clue: " + state.currentCountry.clue);

    const visible = hints.slice(0, state.hintsUsed + 1);
    $("#hintList").html(visible.map((hint) => "<li>" + hint + "</li>").join(""));
    setMessage("Hint revealed. Use the globe and the clue together.", "info");
  }

  function startTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
    }

    state.timerId = setInterval(function () {
      state.timeLeft -= 1;
      updateTimerUI();

      if (state.timeLeft <= 0) {
        clearInterval(state.timerId);
        state.timerId = null;
        state.streak = 0;
        state.wrong += 1;
        updateStats();
        setMessage("Time is up. The correct answer was " + state.currentCountry.name + ".", "error");
        recordHistory("Missed: " + state.currentCountry.name, "error");
        setTimeout(function () {
          nextRound();
        }, 1200);
      }
    }, 1000);
  }

  function nextRound() {
    state.round += 1;
    chooseCountry();
    updateStats();
    startTimer();
  }

  function handleGuess() {
    if (!state.currentCountry) {
      return;
    }

    const value = normalize($("#guessInput").val());
    if (!value) {
      setMessage("Please type a country name first.", "error");
      return;
    }

    const answers = [state.currentCountry.name].concat(state.currentCountry.aliases || []).map(normalize);
    if (answers.includes(value)) {
      clearInterval(state.timerId);
      state.timerId = null;
      state.correct += 1;
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.score += Math.max(50, state.timeLeft * 5 - state.hintsUsed * 10);
      updateStats();
      setMessage("Correct. " + state.currentCountry.name + " was the right answer.", "success");
      recordHistory("Correct: " + state.currentCountry.name, "success");

      setTimeout(function () {
        nextRound();
      }, 1200);
      return;
    }

    state.wrong += 1;
    state.streak = 0;
    updateStats();
    setMessage("Not quite. Try again or use a hint.", "error");
  }

  function skipRound() {
    if (!state.currentCountry) {
      return;
    }

    clearInterval(state.timerId);
    state.timerId = null;
    state.wrong += 1;
    state.streak = 0;
    updateStats();
    setMessage("Skipped. The answer was " + state.currentCountry.name + ".", "error");
    recordHistory("Skipped: " + state.currentCountry.name, "error");

    setTimeout(function () {
      nextRound();
    }, 1000);
  }

  function initEvents() {
    $("#guessForm").on("submit", function (event) {
      event.preventDefault();
      handleGuess();
    });

    $("#hintBtn").on("click", useHint);
    $("#skipBtn").on("click", skipRound);
    $("#nextRoundBtn").on("click", function () {
      clearInterval(state.timerId);
      nextRound();
    });

    $("#pauseRotationBtn").on("click", function () {
      state.autoRotate = !state.autoRotate;
      $(this).text(state.autoRotate ? "Pause rotation" : "Resume rotation");
    });
  }

  $(function () {
    initScene();
    initEvents();
    updateStats();
    chooseCountry();
    startTimer();
  });
})();
