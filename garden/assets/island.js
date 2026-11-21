export function drawIsland(data, showCard, dark) {
  const R3 = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  const nativeRatio = Math.min(devicePixelRatio, 1.5)
  R3.setPixelRatio(nativeRatio)
  R3.shadowMap.enabled = true
  R3.shadowMap.autoUpdate = false
  R3.shadowMap.needsUpdate = true
  R3.shadowMap.type = THREE.PCFSoftShadowMap
  R3.toneMapping = THREE.ACESFilmicToneMapping
  R3.toneMappingExposure = dark ? 0.85 : 0.92
  const stage = document.getElementById('scene')
  stage.appendChild(R3.domElement)
  const S = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 300)
  S.add(
    new THREE.HemisphereLight(
      dark ? 0x9db4e6 : 0xfff4dc,
      dark ? 0x1c2434 : 0x9aa87a,
      dark ? 1.5 : 2.2,
    ),
  )
  const sun = new THREE.DirectionalLight(
    dark ? 0xb8ccff : 0xffdfae,
    dark ? 2.2 : 3.4,
  )
  sun.position.set(9, 14, 6)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
    near: 1,
    far: 40,
  })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.04
  sun.shadow.radius = 4
  S.add(sun)

  let seed = 11
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const rr = (a, b) => a + rnd() * (b - a)
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
  const VM = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.92,
  })
  function jitter(g, a, ys = 1) {
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i)
      const h = (n) => {
        const s =
          Math.sin(x * 12.9898 * n + y * 78.233 + z * 37.719 * n) * 43758.5453
        return s - Math.floor(s) - 0.5
      }
      p.setXYZ(i, x + h(1) * a, y + h(2) * a * ys, z + h(3) * a)
    }
    return g
  }
  function facets(g, col, v = 0.045, fn) {
    g = g.index ? g.toNonIndexed() : g
    const p = g.attributes.position,
      n = p.count,
      c = new Float32Array(n * 3),
      k = new THREE.Color()
    for (let i = 0; i < n; i += 3) {
      const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3
      k.set(fn ? fn(cy) : col).offsetHSL(rr(-0.012, 0.012), 0, rr(-v, v))
      for (let j = 0; j < 3; j++) {
        c[(i + j) * 3] = k.r
        c[(i + j) * 3 + 1] = k.g
        c[(i + j) * 3 + 2] = k.b
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    g.computeVertexNormals()
    return g
  }
  function mesh(g, col, par, x = 0, y = 0, z = 0, v) {
    const m = new THREE.Mesh(facets(g, col, v), VM)
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    par.add(m)
    return m
  }
  const world = new THREE.Group()
  S.add(world)
  const sway = [],
    picks = [],
    anim = []

  /* ---- the land ---- */
  const GRASS = dark ? 0x5f9a68 : 0x7fbf62
  const ig = new THREE.IcosahedronGeometry(5, 7),
    ip = ig.attributes.position
  for (let i = 0; i < ip.count; i++) {
    let x = ip.getX(i),
      y = ip.getY(i),
      z = ip.getZ(i)
    if (y > 0.001) {
      y = 0
    } else {
      const d = -y / 5
      y = -(0.4 * Math.min(1, d * 7) + d * 3.4)
    }
    ip.setXYZ(i, x, y, z)
  }
  jitter(ig, 0.16, 0.25)
  for (let i = 0; i < ip.count; i++)
    if (ip.getY(i) > -0.06) ip.setY(i, Math.min(0, ip.getY(i) * 0.3))
  const land = new THREE.Mesh(
    facets(ig, 0, 0.03, (y) =>
      y > -0.05 ? GRASS : y > -0.5 ? 0x9a7350 : y > -1.9 ? 0x80603f : 0x6b5038,
    ),
    VM,
  )
  land.receiveShadow = true
  land.castShadow = true
  world.add(land)

  const rows = data.items
  const major = [
    'agent',
    'project',
    'app',
    'bed',
    'change',
    'market',
    'idea',
  ].flatMap((kind) => rows[kind])
  if (rows.code.length) major.push({ ...rows.code[0], size: rows.code.length })
  const chats = rows.chat.slice(0, 12)
  const PATCH = 12,
    KEEP = 5,
    MAXF = Math.min(data.flowers, 4096),
    NP = Math.ceil(MAXF / PATCH)
  const bedCount = Math.min(NP, KEEP)
  const slots =
    major.length +
    chats.length +
    bedCount +
    (rows.chat.length > chats.length ? 1 : 0)
  // A young garden shares a small mound. As it fills, landmarks spread out.
  const Rad = Math.min(
    10,
    1.25 + 1.43 * (Math.sqrt(Math.max(3, slots)) - Math.sqrt(3)),
  )
  const young = Rad < 1.9
  const slotPos = (i) => {
    const r =
        slots > 1
          ? (Rad - (young ? 0.66 : 0.85)) * Math.sqrt(i / (slots - 1))
          : 0,
      a = i * 2.39996
    return [Math.cos(a) * r, Math.sin(a) * r]
  }
  let index = 0
  function place(info) {
    const [x, z] = slotPos(index++),
      g = new THREE.Group()
    g.position.set(x, 0, z)
    g.rotation.y = rr(0, 6.28)
    g.userData.info = info
    g.userData.s = 1
    picks.push(g)
    world.add(g)
    return g
  }
  function sproutG(par) {
    const p = new THREE.Group()
    par.add(p)
    mesh(
      new THREE.CylinderGeometry(0.02, 0.028, 0.22, 5),
      0x387645,
      p,
      0,
      0.11,
      0,
    )
    ;[-1, 1].forEach((d) => {
      const l = mesh(
        new THREE.SphereGeometry(0.11, 6, 4),
        d < 0 ? 0x398a58 : 0x4a9d5b,
        p,
        d * 0.09,
        0.24,
        0,
      )
      l.scale.set(1, 0.3, 0.6)
      l.rotation.z = d * 0.5
    })
    return p
  }
  function trunk(par, h, r, col) {
    mesh(
      jitter(new THREE.CylinderGeometry(r * 0.55, r, h, 7, 4), r * 0.22, 0.3),
      col,
      par,
      0,
      h / 2,
      0,
      0.06,
    )
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4,
        c = mesh(
          new THREE.ConeGeometry(r * 0.5, r * 2.6, 5),
          col,
          par,
          Math.cos(a) * r * 0.8,
          r * 0.45,
          Math.sin(a) * r * 0.8,
          0.06,
        )
      c.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1)
    }
  }
  function blobs(f, list, col, parts, jit = 0.17) {
    list.forEach(([a, b, c, r]) =>
      parts.push(
        mesh(
          jitter(new THREE.IcosahedronGeometry(r, 1), r * jit),
          col,
          f,
          a,
          b,
          c,
          0.05,
        ),
      ),
    )
  }
  function tufts(f, n, cy, rad, col, parts, sy = 1, cx = 0, cz = 0) {
    const k = new THREE.Color(col).offsetHSL(0, 0.02, 0.07)
    for (let i = 0; i < n; i++) {
      const u = rr(-0.3, 1),
        a = rr(0, 6.28),
        s = Math.sqrt(1 - u * u)
      parts.push(
        mesh(
          jitter(new THREE.IcosahedronGeometry(rr(0.1, 0.16), 0), 0.03),
          k,
          f,
          cx + Math.cos(a) * s * rad,
          cy + u * rad * sy,
          cz + Math.sin(a) * s * rad,
          0.04,
        ),
      )
    }
  }
  const UP = new THREE.Vector3(0, 1, 0)
  const KINDS = {
    oak(tr, f, parts) {
      trunk(tr, 1.15, 0.17, 0x7b5b3d)
      const b = mesh(
        new THREE.CylinderGeometry(0.035, 0.06, 0.5, 5),
        0x7b5b3d,
        tr,
        0.2,
        0.85,
        0,
      )
      b.rotation.z = -0.9
      f.position.y = 1.1
      blobs(
        f,
        [
          [0, 0.42, 0, 0.6],
          [0.42, 0.2, 0.1, 0.42],
          [-0.4, 0.24, -0.12, 0.46],
          [0.04, 0.14, 0.44, 0.4],
          [-0.05, 0.2, -0.42, 0.4],
          [0, 0.86, 0, 0.38],
          [0.3, 0.62, -0.2, 0.3],
          [-0.3, 0.6, 0.25, 0.3],
          [0.55, 0.45, 0.3, 0.26],
        ],
        0x4fa863,
        parts,
      )
      tufts(f, 16, 0.42, 0.78, 0x4fa863, parts)
    },
    birch(tr, f, parts) {
      trunk(tr, 1.6, 0.11, 0xe9e4d6)
      for (let i = 0; i < 5; i++) {
        const y = 0.25 + i * 0.27
        mesh(
          new THREE.CylinderGeometry(
            0.095 - i * 0.008,
            0.1 - i * 0.008,
            0.035,
            7,
          ),
          0x4a4038,
          tr,
          0,
          y,
          0,
          0.02,
        ).rotation.y = i
      }
      f.position.y = 1.25
      blobs(
        f,
        [
          [0, 0.3, 0, 0.42],
          [0.2, 0.65, 0.05, 0.36],
          [-0.18, 0.9, -0.05, 0.32],
          [0.05, 1.2, 0, 0.26],
          [-0.25, 0.4, 0.15, 0.3],
          [0.22, 0.3, -0.2, 0.28],
          [0, 1.45, 0, 0.17],
        ],
        0xa9c94f,
        parts,
        0.2,
      )
      tufts(f, 12, 0.7, 0.5, 0xa9c94f, parts, 1.5)
    },
    pine(tr, f, parts) {
      trunk(tr, 0.6, 0.12, 0x6e4f36)
      f.position.y = 0.38
      ;[
        [0.72, 0.78, 0.3],
        [0.6, 0.72, 0.68],
        [0.47, 0.66, 1.06],
        [0.34, 0.6, 1.42],
        [0.2, 0.5, 1.76],
      ].forEach(([r, h, y], i) => {
        mesh(
          jitter(new THREE.ConeGeometry(r * 1.08, h * 0.45, 9, 1), 0.05),
          0x2f6f55,
          f,
          0,
          y - h * 0.22,
          0,
          0.04,
        ).rotation.y = i * 0.7 + 0.3
        mesh(
          jitter(new THREE.ConeGeometry(r, h, 9, 2), 0.06),
          0x3f8a6a,
          f,
          0,
          y,
          0,
          0.05,
        ).rotation.y = i * 0.7
      })
    },
    /* an app: a low, wide fruit tree */
    fruit(tr, f, parts) {
      trunk(tr, 0.7, 0.14, 0x8a6444)
      ;[-1, 1].forEach((d) => {
        const b = mesh(
          new THREE.CylinderGeometry(0.045, 0.07, 0.6, 5),
          0x8a6444,
          tr,
          d * 0.2,
          0.85,
          0,
          0.06,
        )
        b.rotation.z = -d * 0.75
      })
      f.position.y = 0.85
      blobs(
        f,
        [
          [0, 0.3, 0, 0.56],
          [0.52, 0.2, 0, 0.42],
          [-0.52, 0.2, 0.1, 0.42],
          [0, 0.2, 0.52, 0.42],
          [0.1, 0.2, -0.52, 0.42],
          [0, 0.62, 0, 0.36],
          [0.36, 0.45, 0.36, 0.3],
          [-0.36, 0.45, -0.3, 0.3],
        ],
        0x6aa84f,
        parts,
        0.14,
      )
    },
    /* a project: a maple that adds a limb, with its own crown, as the folder grows */
    maple: (col) => (tr, f, parts) => {
      trunk(tr, 1.0, 0.15, 0x5e4334)
      f.position.y = 0.95
      const top = new THREE.Group()
      f.add(top)
      parts.push(top)
      mesh(
        jitter(new THREE.IcosahedronGeometry(0.42, 1), 0.07),
        col,
        top,
        0,
        0.5,
        0,
        0.06,
      )
      mesh(
        new THREE.CylinderGeometry(0.05, 0.08, 0.5, 5),
        0x5e4334,
        top,
        0,
        0.2,
        0,
        0.06,
      )
      for (let i = 0; i < 6; i++) {
        const L = new THREE.Group()
        f.add(L)
        parts.push(L)
        const a = i * 2.2 + 0.5,
          tilt = 1.0 - (i % 2) * 0.2,
          len = 0.62 + (i % 3) * 0.08,
          d = new THREE.Vector3(
            Math.sin(tilt) * Math.cos(a),
            Math.cos(tilt),
            Math.sin(tilt) * Math.sin(a),
          )
        const c = mesh(
          new THREE.CylinderGeometry(0.035, 0.065, len, 5),
          0x5e4334,
          L,
          (d.x * len) / 2,
          (d.y * len) / 2 - 0.1,
          (d.z * len) / 2,
          0.06,
        )
        c.quaternion.setFromUnitVectors(UP, d)
        mesh(
          jitter(new THREE.IcosahedronGeometry(0.33 - (i % 3) * 0.03, 1), 0.06),
          col,
          L,
          d.x * len,
          d.y * len + 0.05,
          d.z * len,
          0.06,
        )
        const tmp = []
        tufts(L, 4, d.y * len + 0.05, 0.36, col, tmp, 1, d.x * len, d.z * len)
      }
    },
  }

  function speciesFor(id) {
    return [...id].reduce((n, c) => (Math.imul(n, 31) + c.codePointAt(0)) >>> 0, 7)
  }

  // Breast, cap, flight feathers and tail length distinguish the residents.
  const plumage = [
    [0xd08b5a, 0x6c7783, 0x4e5865, 0.17], // robin
    [0xe3bb55, 0x507f9d, 0x486f87, 0.13], // blue tit
    [0xe2c8a2, 0xbb7650, 0x875940, 0.10], // wren
    [0xece1cd, 0x373f50, 0x465162, 0.23], // wagtail
  ]
  function perchedBird(house, species, x, y, z, yaw) {
    const [breast, cap, wing, tailLength] = plumage[species % plumage.length]
    const bird = new THREE.Group()
    house.add(bird)
    bird.position.set(x, y, z)
    bird.rotation.y = yaw
    const oval = (color, x, y, z, w, h, d) => {
      const part = mesh(new THREE.IcosahedronGeometry(1, 1), color, bird, x, y, z, 0.025)
      part.scale.set(w, h, d)
      return part
    }
    oval(breast, 0, 0.10, 0, 0.15, 0.11, 0.092).rotation.z = 0.22
    oval(cap, 0.105, 0.205, 0, 0.084, 0.086, 0.078)
    for (const side of [-1, 1]) {
      oval(wing, -0.045, 0.12, side * 0.067, 0.11, 0.059, 0.032).rotation.z = 0.23
      oval(0x252222, 0.14, 0.223, side * 0.06, 0.014, 0.014, 0.012)
    }
    const tail = mesh(new THREE.ConeGeometry(0.056, tailLength, 4), wing, bird, -0.14 - tailLength / 4, 0.12, 0)
    tail.rotation.z = 1.22
    mesh(new THREE.ConeGeometry(0.032, 0.085, 5), 0xc89745, bird, 0.209, 0.20, 0).rotation.z = -Math.PI / 2
  }

  for (const row of major) {
    const { kind, size } = row
    const group = place(row)
    if (['agent', 'project', 'app'].includes(kind)) {
      const growth =
        kind === 'agent'
          ? clamp(Math.log2(1 + Math.max(0, size - 12)) / 7)
          : kind === 'project'
            ? clamp(Math.log2(1 + size) / 8)
            : 0.9
      if (kind === 'agent' && growth < 0.15) {
        sproutG(group).scale.setScalar(young ? 2.45 : 1.35)
        continue
      }
      const crown = new THREE.Group(),
        parts = []
      const species = speciesFor(row.id)
      const tree =
        kind === 'project'
          ? KINDS.maple(0xdd893c)
          : kind === 'app'
            ? KINDS.fruit
            : [KINDS.oak, KINDS.birch, KINDS.pine][species % 3]
      tree(group, crown, parts)
      group.add(crown)
      sway.push(crown)
      if (kind === 'agent') {
        const tint = new THREE.Color().setHSL(
          0.12 + (species % 101) / 1400,
          0.14,
          0.86,
        )
        crown.scale.set(
          0.88 + (species % 7) / 24,
          0.9 + ((species >>> 4) % 9) / 16,
          0.96,
        )
        crown.traverse((n) => {
          const colors = n.geometry?.attributes.color
          if (colors)
            for (let i = 0; i < colors.count; i++)
              colors.setXYZ(
                i,
                colors.getX(i) * tint.r,
                colors.getY(i) * tint.g,
                colors.getZ(i) * tint.b,
              )
        })
      }
      const limbs =
        kind === 'project'
          ? 1 + Math.min(6, Math.floor(Math.log2(1 + size)))
          : Math.ceil(parts.length * (0.4 + 0.6 * growth))
      parts.slice(limbs).forEach((m) => m.removeFromParent())
      if (kind === 'app')
        for (let i = 0; i < Math.min(16, size); i++) {
          const a = i * 2.4,
            u = rr(-0.25, 0.6),
            r = Math.sqrt(1 - u * u) * 0.8
          mesh(
            new THREE.IcosahedronGeometry(0.088, 1),
            0xf08a3c,
            crown,
            Math.cos(a) * r,
            0.3 + u * 0.55,
            Math.sin(a) * r,
            0.02,
          )
        }
      group.userData.s = 0.67 + 0.48 * growth
    } else if (kind === 'bed') {
      mesh(
        jitter(new THREE.CylinderGeometry(0.5, 0.56, 0.07, 9), 0.06, 0),
        0x7a5c40,
        group,
        0,
        0.035,
        0,
      )
      for (let i = -2; i <= 2; i++)
        mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.76 - Math.abs(i) * 0.14, 5),
          0x8a6a4a,
          group,
          i * 0.16,
          0.075,
          0,
        ).rotation.x = 1.5708
    } else if (kind === 'change') {
      const g = group
      const w = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.62, 0.05, 14),
        new THREE.MeshStandardMaterial({
          color: dark ? 0x4b79b8 : 0x6fb7dc,
          roughness: 0.15,
          metalness: 0.1,
          flatShading: true,
        }),
      )
      w.position.y = 0.015
      w.receiveShadow = true
      g.add(w)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 6.28 + rr(-0.1, 0.1)
        mesh(
          jitter(new THREE.IcosahedronGeometry(rr(0.11, 0.17), 0), 0.04),
          0xa9a195,
          g,
          Math.cos(a) * 0.66,
          0.04,
          Math.sin(a) * 0.66,
        ).scale.y = 0.6
      }
      for (let i = 0; i < 3; i++)
        mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.015, 7),
          0x5ea85a,
          g,
          rr(-0.3, 0.3),
          0.05,
          rr(-0.3, 0.3),
        ).castShadow = false
      for (let i = 0; i < 4; i++)
        mesh(
          new THREE.CylinderGeometry(0.012, 0.014, rr(0.4, 0.7), 4),
          0x6c9a4c,
          g,
          -0.4 + i * 0.07,
          0.3,
          0.36 - i * 0.05,
        ).rotation.z = rr(-0.12, 0.12)
    } else if (kind === 'market') {
      const g = group,
        wall = 0xf3ead8,
        roof = 0xc8553d
      mesh(
        new THREE.CylinderGeometry(0.035, 0.05, 1.05, 6),
        0x8a6a4a,
        g,
        0,
        0.52,
        0,
      )
      mesh(new THREE.BoxGeometry(0.36, 0.34, 0.32), wall, g, 0, 1.2, 0, 0.03)
      const rf = mesh(
        new THREE.ConeGeometry(0.36, 0.24, 4),
        roof,
        g,
        0,
        1.49,
        0,
        0.04,
      )
      rf.rotation.y = 0.785
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.02, 10),
        new THREE.MeshBasicMaterial({ color: 0x2e211a }),
      )
      hole.rotation.x = 1.57
      hole.position.set(0, 1.24, 0.165)
      g.add(hole)
      mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.14, 4),
        0x8a6a4a,
        g,
        0,
        1.1,
        0.22,
      ).rotation.x = 1.57
      const species = speciesFor(row.id)
      perchedBird(g, species, 0, 1.605, 0, 0.12)
      if (size >= 2) perchedBird(g, species, 0, 1.11, 0.26, 2.8)
      if (size >= 3) perchedBird(g, species, -0.20, 1.42, -0.08, 2.5)
      if (size >= 4) perchedBird(g, species, 0.20, 1.42, -0.12, -0.7)
    } else if (kind === 'idea') {
      const g = group
      mesh(new THREE.BoxGeometry(0.56, 0.05, 0.56), 0x8a6a4a, g, 0, 0.3, 0)
      ;[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].forEach(([a, b]) =>
        mesh(
          new THREE.CylinderGeometry(0.025, 0.03, 0.3, 5),
          0x7a5c40,
          g,
          a * 0.22,
          0.15,
          b * 0.22,
        ),
      )
      ;[
        [0.23, 0.25],
        [0.26, 0.26],
        [0.25, 0.26],
        [0.2, 0.25],
        [0.12, 0.2],
      ].forEach(([rt, rb], i) =>
        mesh(
          new THREE.CylinderGeometry(rt, rb, 0.1, 10),
          i % 2 ? 0xd9ad4f : 0xe6c36a,
          g,
          0,
          0.375 + i * 0.1,
          0,
          0.03,
        ),
      )
      mesh(
        new THREE.IcosahedronGeometry(0.06, 1),
        0xd9ad4f,
        g,
        0,
        0.86,
        0,
        0.03,
      )
      const door = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8),
        new THREE.MeshBasicMaterial({ color: 0x2e211a }),
      )
      door.rotation.x = 1.57
      door.position.set(0, 0.39, 0.25)
      g.add(door)
      const bm = new THREE.MeshBasicMaterial({ color: 0xf6c343 }),
        bees = []
      for (let i = 0; i < 8; i++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0), bm)
        g.add(b)
        bees.push(b)
      }

      bees.forEach((b) => (b.visible = row.shipped))
      anim.push((s) =>
        bees.forEach((b, i) => {
          const a = s * (1.5 + i * 0.2) + i * 2
          b.position.set(
            Math.cos(a) * (0.3 + 0.12 * Math.sin(s * 2 + i)),
            0.6 + Math.sin(s * 3 + i * 1.7) * 0.25,
            Math.sin(a * 1.3) * (0.3 + 0.1 * Math.cos(s + i)),
          )
        }),
      )
    } else if (kind === 'code') {
      const g = group
      mesh(
        jitter(new THREE.CylinderGeometry(0.27, 0.32, 0.1, 6), 0.02, 0),
        0xa9a59c,
        g,
        0,
        0.05,
        0,
      )
      mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 0.5, 6),
        0xb3aea4,
        g,
        0,
        0.35,
        0,
      )
      mesh(
        new THREE.CylinderGeometry(0.25, 0.17, 0.08, 6),
        0xa9a59c,
        g,
        0,
        0.64,
        0,
      )
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.24, 0.26),
        new THREE.MeshStandardMaterial({
          color: 0xffe6ad,
          emissive: 0xffb040,
          emissiveIntensity: dark ? 2.4 : 0.7,
          flatShading: true,
        }),
      )
      glow.position.y = 0.8
      g.add(glow)
      ;[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].forEach(([a, b]) =>
        mesh(
          new THREE.BoxGeometry(0.045, 0.26, 0.045),
          0x9a968d,
          g,
          a * 0.13,
          0.8,
          b * 0.13,
        ),
      )
      mesh(
        jitter(new THREE.ConeGeometry(0.4, 0.24, 6), 0.02, 0),
        0x8f8b83,
        g,
        0,
        1.04,
        0,
      )
      mesh(new THREE.IcosahedronGeometry(0.055, 1), 0x9a968d, g, 0, 1.2, 0)
      if (dark) {
        const pl = new THREE.PointLight(0xffb040, 7, 5, 2)
        pl.position.y = 0.85
        g.add(pl)
      }

      const tierHeight = Math.min(0.068, 0.49 / Math.max(1, size - 1))
      for (let i = 1; i < size; i++)
        mesh(
          new THREE.CylinderGeometry(0.255, 0.3, tierHeight, 6),
          0x9a968d,
          g,
          0,
          0.12 + i * tierHeight,
          0,
        )
    }
  }
  function shrub(row, low = false) {
    const g = place(row),
      parts = [],
      fl = [],
      growth = low ? 0.3 : clamp(row.size / 36)
    blobs(
      g,
      [
        [0, 0.17, 0, 0.25],
        [0.2, 0.13, 0.05, 0.18],
        [-0.18, 0.14, 0.08, 0.2],
        [0.02, 0.12, -0.2, 0.18],
        [0.06, 0.32, 0.02, 0.17],
        [-0.1, 0.3, -0.08, 0.14],
      ],
      0x3d9478,
      parts,
      0.2,
    )
    for (let j = 0; j < 9; j++) {
      const a = j * 2.4,
        u = rr(0.1, 0.9),
        s = Math.sqrt(1 - u * u) * 0.3
      fl.push(
        mesh(
          new THREE.IcosahedronGeometry(0.04, 0),
          j % 2 ? 0xffffff : 0xf7c6d8,
          g,
          Math.cos(a) * s,
          0.2 + u * 0.26,
          Math.sin(a) * s,
          0.02,
        ),
      )
    }

    parts
      .slice(Math.max(2, Math.ceil(parts.length * growth)))
      .forEach((m) => m.removeFromParent())
    if (growth < 1) fl.forEach((m) => m.removeFromParent())
    g.userData.s = low ? 0.65 : (young ? 0.44 : 0.6) + growth * 0.55
  }
  chats.forEach((row) => shrub(row))
  if (chats.length < rows.chat.length)
    shrub(
      {
        kind: 'copse',
        name: 'Earlier chats',
        size: rows.chat.length - chats.length,
      },
      true,
    )
  const patchStart = index
  const at = (k) => {
    const p = Number(k.slice(1))
    return slotPos(patchStart + Math.max(0, p - (NP - bedCount)))
  }
  const IM = new THREE.MeshStandardMaterial({
    flatShading: true,
    roughness: 0.9,
  })
  const inst = (geo, n, cast) => {
    const m = new THREE.InstancedMesh(geo, IM, n)
    m.castShadow = cast
    m.receiveShadow = true
    world.add(m)
    return m
  }
  const beds = inst(
      jitter(new THREE.CylinderGeometry(0.54, 0.6, 0.1, 9), 0.05, 0),
      NP,
      true,
    ),
    stems = inst(
      new THREE.CylinderGeometry(0.013, 0.018, 1, 4).translate(0, 0.5, 0),
      NP * PATCH,
      false,
    ),
    leaves = inst(
      new THREE.SphereGeometry(0.07, 5, 3).scale(1, 0.25, 0.55),
      NP * PATCH,
      false,
    ),
    heads = inst(new THREE.IcosahedronGeometry(0.085, 0), NP * PATCH, true),
    eyes = inst(new THREE.IcosahedronGeometry(0.036, 0), NP * PATCH, false)
  const PAL = [
    [0xf2a65a, 0.3],
    [0xe86a6a, 0.26],
    [0xf6d55c, 0.46],
    [0xb58ae0, 0.36],
    [0xffffff, 0.22],
    [0xf29ab5, 0.3],
    [0x7fb4f0, 0.34],
  ]
  const M = new THREE.Matrix4(),
    Q = new THREE.Quaternion(),
    E = new THREE.Euler(),
    V = new THREE.Vector3(),
    SC = new THREE.Vector3(),
    K = new THREE.Color(),
    ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
  const bedM = [],
    FM = []
  function flowerM(x, z, y0, h) {
    const o = []
    o.push(
      new THREE.Matrix4().compose(
        V.set(x, y0, z),
        Q.identity(),
        SC.set(1, h, 1),
      ),
    )
    o.push(
      new THREE.Matrix4().compose(
        V.set(x + 0.045, y0 + h * 0.45, z),
        Q.setFromEuler(E.set(0, rr(0, 6.28), 0.3)),
        SC.set(1, 1, 1),
      ),
    )
    o.push(
      new THREE.Matrix4().compose(
        V.set(x, y0 + h + 0.04, z),
        Q.setFromEuler(E.set(rr(0, 3), rr(0, 3), 0)),
        SC.set(1, 0.8, 1),
      ),
    )
    o.push(
      new THREE.Matrix4().compose(
        V.set(x, y0 + h + 0.1, z),
        Q.identity(),
        SC.set(1, 1, 1),
      ),
    )
    return o
  }
  for (let p = 0; p < NP; p++) {
    const [px, pz] = at('p' + p)
    bedM.push(
      new THREE.Matrix4().compose(
        V.set(px, 0.05, pz),
        Q.setFromEuler(E.set(0, rr(0, 6.28), 0)),
        SC.set(1, 1, 1),
      ),
    )
    beds.setColorAt(p, K.set(0x6f5239).offsetHSL(0, 0, rr(-0.03, 0.03)))
    const [col, ht] = PAL[p % PAL.length],
      [col2] = PAL[(p * 3 + 1) % PAL.length]
    for (let k = 0; k < PATCH; k++) {
      const i = p * PATCH + k,
        r = k == 0 ? 0 : k < 5 ? 0.2 : 0.4,
        a = young && k === 1 ? -0.76 : k < 5 ? k * 1.57 + p : k * 0.9 + p,
        h = ht * rr(0.8, 1.2),
        ma = rr(0, 6.28),
        mr = Math.sqrt(rr(0.06, 0.94)) * (Rad - 0.4)
      FM.push({
        b: flowerM(
          px + Math.cos(a) * r + rr(-0.03, 0.03),
          pz + Math.sin(a) * r + rr(-0.03, 0.03),
          0.09,
          h,
        ),
        m: flowerM(Math.cos(ma) * mr, Math.sin(ma) * mr, 0, h * 0.49),
      })
      stems.setColorAt(i, K.set(0x4f8f4a))
      leaves.setColorAt(i, K.set(0x5fa655))
      heads.setColorAt(
        i,
        K.set((young && k === 1) || k % 4 === 3 ? col2 : col).offsetHSL(
          0,
          0,
          rr(-0.04, 0.04),
        ),
      )
      eyes.setColorAt(i, K.set(0xf6c343))
    }
  }
  const flowerInfo = {
    kind: 'flower',
    name: 'Your files',
    size: data.counts.flower,
  }
  ;[beds, heads].forEach((m) => {
    m.userData.info = flowerInfo
    m.userData.s = 0
    picks.push(m)
  })
  // At phone overview scale, a meadow flower is only a few pixels across.
  // Give each one its own faceted bloom; bring back its four meshes on zoom.
  const meadowCount = Math.max(0, NP - KEEP) * PATCH
  const meadowVertices = [],
    meadowColors = []
  const centerColor = new THREE.Color(0xf6c343)
  const stemColor = new THREE.Color(0x4f8f4a)
  const bloomColor = new THREE.Color()
  const originalColors = heads.instanceColor?.array.slice()
  function triangle(a, b, c, ca, cb, cc) {
    meadowVertices.push(...a, ...b, ...c)
    for (const color of [ca, cb, cc])
      meadowColors.push(color.r, color.g, color.b)
  }
  for (let p = 0; p < NP; p++)
    beds.setMatrixAt(p, p < NP - KEEP || (young && MAXF < 5) ? ZERO : bedM[p])
  for (let i = 0; i < MAXF; i++) {
    const isMeadow = i < meadowCount
    const m = isMeadow ? FM[i].m : FM[i].b
    const index = isMeadow ? MAXF - meadowCount + i : i - meadowCount
    stems.setMatrixAt(index, m[0])
    leaves.setMatrixAt(index, m[1])
    heads.setMatrixAt(index, m[2])
    eyes.setMatrixAt(index, m[3])
    bloomColor.fromArray(originalColors, i * 3)
    heads.setColorAt(index, bloomColor)
    if (!isMeadow) continue
    const [x, y, z] = V.setFromMatrixPosition(m[2]).toArray()
    triangle(
      [x - 0.02, 0, z],
      [x + 0.02, 0, z],
      [x, y, z],
      stemColor,
      stemColor,
      stemColor,
    )
    const center = [x, y + 0.065, z]
    for (let k = 0; k < 5; k++) {
      const a = (k * 2 * Math.PI) / 5,
        b = ((k + 1) * 2 * Math.PI) / 5
      triangle(
        center,
        [x + 0.085 * Math.cos(b), y, z + 0.085 * Math.sin(b)],
        [x + 0.085 * Math.cos(a), y, z + 0.085 * Math.sin(a)],
        centerColor,
        bloomColor,
        bloomColor,
      )
    }
  }
  const meadowGeometry = new THREE.BufferGeometry()
  meadowGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(meadowVertices, 3),
  )
  meadowGeometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(meadowColors, 3),
  )
  meadowGeometry.computeVertexNormals()
  const meadow = new THREE.Mesh(
    meadowGeometry,
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
  )
  meadow.visible = false
  meadow.userData.info = flowerInfo
  world.add(meadow)
  function flowerDetail(distant) {
    meadow.visible = meadowCount > 0 && distant
    const count = meadow.visible ? MAXF - meadowCount : MAXF
    if (stems.count === count) return
    for (const mesh of [stems, leaves, heads, eyes]) {
      mesh.count = count
      mesh.boundingSphere = null
    }
  }
  flowerDetail(false)

  /* ---- grass and stones between things ---- */

  const allSlots = Array.from({ length: slots }, (_, i) => slotPos(i)),
    RMAX = Rad,
    tp = []
  for (
    let i = 0;
    i < Math.min(1250, Math.round((young ? 7 : 17) * Rad * Rad));
    i++
  ) {
    const a = rr(0, 6.28),
      r = Math.sqrt(rnd()) * RMAX,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r
    if (allSlots.every(([sx, sz]) => Math.hypot(x - sx, z - sz) > 0.6))
      tp.push([r, x, z])
  }
  tp.sort((a, b) => a[0] - b[0])
  const grass = inst(
    new THREE.ConeGeometry(0.05, 0.26, 4).translate(0, 0.13, 0),
    tp.length,
    false,
  )
  tp.forEach(([r, x, z], i) => {
    M.compose(
      V.set(x, 0, z),
      Q.setFromEuler(E.set(rr(-0.25, 0.25), rr(0, 3), rr(-0.25, 0.25))),
      SC.set(rr(0.7, 1.3), rr(0.6, 1.4), rr(0.7, 1.3)),
    )
    grass.setMatrixAt(i, M)
    grass.setColorAt(
      i,
      K.set(dark ? 0x6fae72 : 0x6fb55a).offsetHSL(0, 0, rr(-0.05, 0.05)),
    )
  })
  const stones = []
  for (let i = 0; tp.length && i < Math.min(15, Math.floor(Rad)); i++) {
    const [r, x, z] = tp[Math.floor(rnd() * tp.length)]
    const m = mesh(
      jitter(
        new THREE.IcosahedronGeometry(rr(0.08, young ? 0.1 : 0.2), 0),
        0.03,
      ),
      young ? 0x939b71 : 0xa7a096,
      world,
      x,
      0.05,
      z,
    )
    m.scale.y = 0.7
    stones.push([r, m])
  }
  const fliers = []
  for (let i = 0; i < (young ? (dark ? 3 : 1) : dark ? 9 : 3); i++) {
    const g = new THREE.Group()
    if (dark) {
      g.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xfff2a0 }),
        ),
      )
    } else {
      ;[-1, 1].forEach((d) => {
        const sh = new THREE.Shape()
        sh.moveTo(0, 0)
        sh.lineTo(0.09 * d, 0.07)
        sh.lineTo(0.08 * d, -0.05)
        const w = new THREE.Mesh(
          new THREE.ShapeGeometry(sh),
          new THREE.MeshBasicMaterial({
            color: [0xffffff, 0xf7c948, 0xf29ab5][i],
            side: 2,
          }),
        )
        w.rotation.x = -1.57
        w.userData.d = d
        g.add(w)
      })
    }
    g.userData = {
      r: rr(0.3, 0.75),
      sp: rr(0.15, 0.4) * (i % 2 ? 1 : -1),
      ph: rr(0, 6.28),
      h: rr(0.5, 1.9),
    }
    world.add(g)
    fliers.push(g)
  }

  let az = 0.75,
    pol = innerWidth < innerHeight ? 0.68 : 1.02,
    zoom = 1,
    vaz = 0.0008,
    vpol = 0,
    touched = false
  const target = new THREE.Vector3(0, 0.35, 0)
  let redraw = true
  function fit() {
    redraw = true
    const w = Math.max(1, stage.clientWidth),
      h = Math.max(1, stage.clientHeight)
    R3.setSize(w, h)
    cam.aspect = w / h
    cam.updateProjectionMatrix()
  }
  new ResizeObserver(fit).observe(stage)
  fit()
  const ptr = new Map()
  let moved = 0,
    pinch = 0
  const cv = R3.domElement,
    hint = document.getElementById('hint'),
    card = document.getElementById('card')
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId)
    ptr.set(e.pointerId, [e.clientX, e.clientY])
    moved = 0
    if (ptr.size == 2) {
      const [a, b] = [...ptr.values()]
      pinch = Math.hypot(a[0] - b[0], a[1] - b[1])
    }
  })
  cv.addEventListener('pointermove', (e) => {
    if (!ptr.has(e.pointerId)) return
    const p = ptr.get(e.pointerId),
      dx = e.clientX - p[0],
      dy = e.clientY - p[1]
    ptr.set(e.pointerId, [e.clientX, e.clientY])
    moved += Math.abs(dx) + Math.abs(dy)
    if (ptr.size == 1) {
      vaz = dx * 0.006
      vpol = -dy * 0.004
      az += vaz
      pol += vpol
      touched = true
      hint.style.opacity = 0
    } else if (ptr.size == 2) {
      const [a, b] = [...ptr.values()],
        d = Math.hypot(a[0] - b[0], a[1] - b[1])
      zoom *= pinch / d
      pinch = d
    }
  })
  const up = (e) => {
    ptr.delete(e.pointerId)
    if (moved < 6 && e.type == 'pointerup') tap(e)
  }
  cv.addEventListener('pointerup', up)
  cv.addEventListener('pointercancel', up)
  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      zoom *= 1 + Math.sign(e.deltaY) * 0.07
    },
    { passive: false },
  )

  const ray = new THREE.Raycaster()
  function tap(e) {
    const rect = cv.getBoundingClientRect()
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      cam,
    )
    const hit = ray.intersectObjects(picks, true).find((h) => {
      let n = h.object
      while (n) {
        if (!n.visible) return false
        n = n.parent
      }
      return true
    })
    let o = hit?.object
    while (o && !o.userData.info) o = o.parent
    showCard(o?.userData.info)
    if (o) hint.style.opacity = 0
  }
  // Merge static faceted parts with the same material into one draw per plant.
  // Keep each crown separate so it can sway, and keep each plant pickable.
  function batch(root) {
    root.updateWorldMatrix(true, true)
    const inv = root.matrixWorld.clone().invert(),
      positions = [],
      colors = [],
      normals = [],
      remove = []
    root.traverse((n) => {
      if (n === root || n.material !== VM || !n.visible) return
      let parent = n.parent
      while (parent !== root) {
        if (sway.includes(parent) || !parent.visible) return
        parent = parent.parent
      }
      const geo = n.geometry
        .clone()
        .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, n.matrixWorld))
      for (const [key, out] of [
        ['position', positions],
        ['color', colors],
        ['normal', normals],
      ])
        for (const v of geo.attributes[key].array) out.push(v)
      geo.dispose()
      remove.push(n)
    })
    if (!remove.length) return
    const geo = new THREE.BufferGeometry()
    for (const [key, arr] of [
      ['position', positions],
      ['color', colors],
      ['normal', normals],
    ])
      geo.setAttribute(key, new THREE.Float32BufferAttribute(arr, 3))
    remove.forEach((n) => {
      n.geometry.dispose()
      n.removeFromParent()
    })
    const m = new THREE.Mesh(geo, VM)
    m.castShadow = m.receiveShadow = true
    root.add(m)
  }
  sway.forEach(batch)
  picks.filter((p) => !p.isInstancedMesh).forEach(batch)
  const k5 = Rad / 5
  land.scale.set(k5, young ? k5 * 0.86 : 0.48 + 0.46 * k5, k5)
  picks
    .filter((p) => !p.isInstancedMesh)
    .forEach((g) => g.scale.setScalar(g.userData.s))
  grass.count = tp.filter((p) => p[0] < Rad - 0.35).length
  stones.forEach(([r, m]) => (m.visible = r < Rad - 0.4))
  picks.push(meadow)
  let measuredAt = 0,
    frames = 0,
    slow = 0,
    fast = 0
  const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches
  let lastAz, lastPol, lastZoom
  function frame(t) {
    requestAnimationFrame(frame)
    if (document.hidden) {
      measuredAt = frames = slow = fast = 0
      return
    }
    if (!measuredAt) measuredAt = t
    frames++
    if (t - measuredAt > 1500) {
      const fps = frames * 1000 / (t - measuredAt)
      slow = innerWidth < 700 && !reduced && fps < 25 ? slow + 1 : 0
      fast = fps > 45 ? fast + 1 : 0
      const current = R3.getPixelRatio()
      let next = current
      if (slow >= 3) next = Math.max(Math.min(0.65, nativeRatio), current * 0.8)
      if (fast >= 2 || innerWidth >= 700) next = Math.min(nativeRatio, current / 0.8)
      if (next !== current) {
        R3.setPixelRatio(next)
        slow = fast = 0
        fit()
      }
      frames = 0
      measuredAt = t
    }
    const s = reduced ? 0 : t / 1000
    if (!ptr.size) {
      az += reduced && !touched ? 0 : vaz
      pol += vpol
      vpol *= 0.9
      vaz = touched ? vaz * 0.93 : 0.0008
    }
    pol = clamp(pol, 0.45, 1.38)
    zoom = clamp(zoom, 0.3, 1.25)
    if (
      reduced &&
      !redraw &&
      Math.abs(az - lastAz) < 0.0001 &&
      Math.abs(pol - lastPol) < 0.0001 &&
      zoom === lastZoom
    )
      return
    lastAz = az
    lastPol = pol
    lastZoom = zoom
    redraw = false
    const portrait = innerWidth < innerHeight
    const dist =
      (Math.max(young ? 6.65 : 6, Rad * (portrait ? 4.03 : 4.15)) /
        Math.min(1, cam.aspect)) *
      zoom
    flowerDetail(innerWidth < 700 && zoom > 0.68)
    target.y = young ? -0.08 : -0.25 * k5
    cam.position.set(
      target.x + dist * Math.sin(pol) * Math.cos(az),
      target.y + dist * Math.cos(pol),
      target.z + dist * Math.sin(pol) * Math.sin(az),
    )
    cam.lookAt(target)
    world.position.y = Math.sin(s * 0.5) * 0.06
    sway.forEach((f, i) => {
      f.rotation.z = Math.sin(s * 0.9 + i * 1.7) * 0.025
      f.rotation.x = Math.cos(s * 0.7 + i) * 0.02
    })
    anim.forEach((f) => f(s))
    fliers.forEach((g) => {
      const u = g.userData,
        a = u.ph + s * u.sp,
        r = u.r * Rad
      g.position.set(
        Math.cos(a) * r,
        u.h + Math.sin(s * 1.3 + u.ph) * 0.25,
        Math.sin(a) * r,
      )
      g.rotation.y = -a + (u.sp > 0 ? 0 : 3.14)
      g.children.forEach((w) => {
        if (w.userData.d)
          w.rotation.y = w.userData.d * (0.2 + Math.abs(Math.sin(s * 9 + u.ph)))
      })
    })
    R3.render(S, cam)
  }
  requestAnimationFrame(frame)
}
