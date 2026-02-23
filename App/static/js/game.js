// Juego con zonas, sprites y control direccional
(() => {
    const GRID = 9;
    const CELL = 48;
    const CANVAS_SIZE = GRID * CELL;

    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return console.error('Canvas no encontrado');
    const ctx = canvas.getContext('2d');

    // SPRITE SYSTEM (soporta imágenes en static/resources con fallback y spritesheets)
    const spriteSheet = {};

    function createSprite(name, char, color, resource, frames = 1) {
        const sprite = { char, color, img: null, frames };
        spriteSheet[name] = sprite;
        if (resource) {
            const img = new Image();
            img.onload = () => { sprite.img = img; };
            img.onerror = () => { sprite.img = null; };
            img.src = `/static/resources/${resource}`;
        }
    }

    function drawSprite(x, y, name) {
        const sprite = spriteSheet[name];
        if (!sprite) return;

        const size = CELL - 12;
        const half = size / 2;

        if (sprite.img) {
            if (sprite.frames && sprite.frames > 1 && name === 'player') {
                const dirMap = { 'down': 0, 'up': 1, 'left': 2, 'right': 3 };
                const fi = dirMap[state.player.dir] || 0;
                ctx.drawImage(sprite.img, (fi % 2) * 48, Math.floor(fi / 2) * 48, 48, 48, x - half, y - half, size, size);
                return;
            }
            ctx.drawImage(sprite.img, x - half, y - half, size, size);
            return;
        }

        // Fallback: dibujar círculo con carácter
        ctx.fillStyle = sprite.color;
        ctx.beginPath();
        ctx.arc(x, y, CELL / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(sprite.char, x, y);
    }

    // Registrar sprites usando recursos disponibles en static/resources
    createSprite('player', 'P', '#60a5fa', 'player.png', 4);
    createSprite('enemy', 'E', '#ff6b6b', 'enemy.png', 1);
    createSprite('chest', 'C', '#f97316', 'tile.png', 1);
    createSprite('tile', '', '#061028', 'tile.png', 1);

    // ZONES SYSTEM
    const zones = {
        'forest': {
            name: 'Bosque',
            spawn: { x: 4, y: 4 },
            connections: [
                { dir: 'right', to: 'castle', dest: { x: 1, y: 4 } },
                { dir: 'down', to: 'cave', dest: { x: 4, y: 1 } }
            ],
            items: [{ x: 7, y: 7, type: 'chest' }]
        },
        'castle': {
            name: 'Castillo',
            spawn: { x: 7, y: 4 },
            connections: [
                { dir: 'left', to: 'forest', dest: { x: 7, y: 4 } },
                { dir: 'down', to: 'dungeon', dest: { x: 4, y: 1 } }
            ],
            items: [{ x: 3, y: 3, type: 'chest' }]
        },
        'cave': {
            name: 'Cueva',
            spawn: { x: 4, y: 7 },
            connections: [
                { dir: 'up', to: 'forest', dest: { x: 4, y: 7 } }
            ],
            items: [{ x: 2, y: 4, type: 'chest' }]
        },
        'dungeon': {
            name: 'Mazmorra',
            spawn: { x: 4, y: 7 },
            connections: [
                { dir: 'up', to: 'castle', dest: { x: 4, y: 7 } }
            ],
            items: []
        }
    };

    // GAME STATE
    const state = {
        player: { x: 4, y: 4, hp: 10, dir: 'down', zone: 'forest' },
        enemies: [],
        kills: 0,
        tick: 0,
        zoneEnemies: { 'forest': 3, 'castle': 2, 'cave': 3, 'dungeon': 4 }
    };

    function getZone() {
        return zones[state.player.zone];
    }

    function gridToPixel(coord) {
        return coord * CELL + CELL / 2;
    }

    function spawnEnemiesForZone(zoneKey) {
        state.enemies = [];
        const count = state.zoneEnemies[zoneKey] || 3;
        for (let i = 0; i < count; i++) {
            let ex, ey, ok = false;
            while (!ok) {
                ex = Math.floor(Math.random() * GRID);
                ey = Math.floor(Math.random() * GRID);
                if (Math.abs(ex - state.player.x) > 2 || Math.abs(ey - state.player.y) > 2) ok = true;
            }
            state.enemies.push({ x: ex, y: ey, hp: 30, zone: zoneKey });
        }
    }

    function setDirection(dir) {
        state.player.dir = dir;
        updateDirectionIndicator();
    }

    function movePlayer(dir) {
        const zone = getZone();
        if (!zone) return;

        let nx = state.player.x, ny = state.player.y;
        if (dir === 'up') ny--;
        if (dir === 'down') ny++;
        if (dir === 'left') nx--;
        if (dir === 'right') nx++;

        if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
            for (const conn of zone.connections) {
                if (conn.dir === dir) {
                    changeZone(conn.to, conn.dest);
                    return;
                }
            }
            return;
        }

        state.player.x = nx;
        state.player.y = ny;
        render();
    }

    function changeZone(zoneName, dest) {
        if (!zones[zoneName]) return;
        state.player.zone = zoneName;
        state.player.x = dest.x;
        state.player.y = dest.y;
        spawnEnemiesForZone(zoneName);
        updateHUD();
        render();
    }

    function playerAttack() {
        const dir = state.player.dir;
        let ax = state.player.x, ay = state.player.y;
        if (dir === 'up') ay--;
        if (dir === 'down') ay++;
        if (dir === 'left') ax--;
        if (dir === 'right') ax++;

        if (ax < 0 || ax >= GRID || ay < 0 || ay >= GRID) return;

        for (let i = state.enemies.length - 1; i >= 0; i--) {
            const e = state.enemies[i];
            if (e.x === ax && e.y === ay && e.zone === state.player.zone) {
                e.hp -= 30;
                if (e.hp <= 0) {
                    state.enemies.splice(i, 1);
                    state.kills++;
                    state.player.hp = Math.min(100, state.player.hp + 1);
                }
                break;
            }
        }
        render();
    }

    function updateEnemies() {
        for (const e of state.enemies) {
            if (Math.random() < 0.15) {
                const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
                const r = dirs[Math.floor(Math.random() * dirs.length)];
                const nx = e.x + r.x, ny = e.y + r.y;
                if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && !(nx === state.player.x && ny === state.player.y)) {
                    e.x = nx;
                    e.y = ny;
                }
            }
            if (e.x === state.player.x && e.y === state.player.y) state.player.hp -= 1;
        }
    }

    function drawGrid() {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const tile = spriteSheet['tile'];
        if (tile && tile.img) {
            for (let gy = 0; gy < GRID; gy++) {
                for (let gx = 0; gx < GRID; gx++) {
                    ctx.drawImage(tile.img, gx * CELL, gy * CELL, CELL, CELL);
                }
            }
        } else {
            ctx.fillStyle = '#061028';
            ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        }
        ctx.strokeStyle = '#083243';
        ctx.lineWidth = 1;
        for (let i = 0; i <= GRID; i++) {
            ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, CANVAS_SIZE); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(CANVAS_SIZE, i * CELL); ctx.stroke();
        }
    }

    function drawEntities() {
        const zone = getZone();
        if (!zone) return;
        for (const item of zone.items) {
            drawSprite(gridToPixel(item.x), gridToPixel(item.y), item.type);
        }
        for (const e of state.enemies) {
            if (e.zone === state.player.zone) {
                drawSprite(gridToPixel(e.x), gridToPixel(e.y), 'enemy');
            }
        }
        drawSprite(gridToPixel(state.player.x), gridToPixel(state.player.y), 'player');
        const d = state.player.dir;
        const off = Math.floor(CELL * 0.33);
        let ox = 0, oy = 0;
        if (d === 'up') oy = -off;
        if (d === 'down') oy = off;
        if (d === 'left') ox = -off;
        if (d === 'right') ox = off;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(gridToPixel(state.player.x) + ox, gridToPixel(state.player.y) + oy, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    function updateHUD() {
        const hp = document.getElementById('hp');
        const kills = document.getElementById('kills');
        const zone = document.getElementById('zone');
        if (hp) hp.textContent = `${state.player.hp}`;
        if (kills) kills.textContent = `${state.kills}`;
        if (zone) zone.textContent = getZone().name;
    }

    function render() {
        drawGrid();
        drawEntities();
        updateHUD();
    }

    // INPUT
    window.addEventListener('keydown', (ev) => {
        const k = ev.key.toLowerCase();
        if (['w'].includes(k)) { movePlayer('up'); ev.preventDefault(); }
        if (['s'].includes(k)) { movePlayer('down'); ev.preventDefault(); }
        if (['a'].includes(k)) { movePlayer('left'); ev.preventDefault(); }
        if (['d'].includes(k)) { movePlayer('right'); ev.preventDefault(); }
        if (['arrowup'].includes(k)) { setDirection('up'); ev.preventDefault(); }
        if (['arrowdown'].includes(k)) { setDirection('down'); ev.preventDefault(); }
        if (['arrowleft'].includes(k)) { setDirection('left'); ev.preventDefault(); }
        if (['arrowright'].includes(k)) { setDirection('right'); ev.preventDefault(); }
        if (k === 'enter') { playerAttack(); }
    });

    canvas.addEventListener('click', () => movePlayerForward());

    document.getElementById('restartBtn').addEventListener('click', () => {
        state.player = { x: 4, y: 4, hp: 100, dir: 'down', zone: 'forest' };
        state.kills = 0;
        spawnEnemiesForZone('forest');
        render();
    });

    function loop() {
        state.tick++;
        if (state.tick % 20 === 0) updateEnemies();
        render();
        if (state.player.hp <= 0) {
            setTimeout(() => {
                alert(`Juego terminado en ${getZone().name}\nEliminados: ${state.kills}`);
                // Enviar score al servidor ligado al grupo si está disponible
                if (window.GAME_CONTEXT && window.GAME_CONTEXT.groupId) {
                    try {
                        fetch(`/groups/${window.GAME_CONTEXT.groupId}/game/score`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'same-origin',
                            body: JSON.stringify({ kills: state.kills })
                        }).catch((e) => console.warn('No se pudo enviar score', e));
                    } catch (e) { console.warn('Error al enviar score', e); }
                }

                state.player.hp = 10;
                state.kills = 0;
                changeZone('forest', zones['forest'].spawn);
                render();
            }, 100);
        }
        requestAnimationFrame(loop);
    }

    // INIT
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    spawnEnemiesForZone('forest');
    render();
    requestAnimationFrame(loop);
})();
