const asset_sphere = (id, options) => {
    id = "" + id;

    Settings = Object.assign({
        diameter: 1,
        segments: 16,
        emissiveColor : false,
        diffuseColor: new BABYLON.Color3(1, 1, 1),
        alpha: 0.5,
    }, options || {});

    let mat = new BABYLON.StandardMaterial("sphereDefaultMaterial");
    mat.diffuseColor = Settings.diffuseColor;
    mat.alpha = Settings.alpha;

    if (Settings.emissiveColor) mat.emissiveColor = Settings.emissiveColor;

    let Mesh = BABYLON.MeshBuilder
        .CreateSphere(
            id, {
                diameter: Settings.diameter,
                segments: Settings.segments,
            });
    Mesh.material = mat;

    return Mesh;
};

const asset_test_cube = (id, options) => {
    id = "" + id;

    Settings = Object.assign({
        size: 1,
        diffuseColor: false,
        srcTexture: "/artwork/cube-guide.jpg",
        Shadows: false,
        alpha: 0.5,
    }, options || {});

    let mat = new BABYLON.StandardMaterial("mat");
    if (Settings.srcTexture) {
        let texture = new BABYLON.Texture(Settings.srcTexture);
        mat.diffuseTexture = texture;
    }
    if (Settings.diffuseColor) {
        mat.diffuseColor = Settings.diffuseColor;
    }
    mat.alpha = Settings.alpha;

    let faceUV = new Array(6);
    for (let i = 0; i < 6; i++) {
        // https://playground.babylonjs.com/#6XIT28#5
        faceUV[i] = new BABYLON.Vector4(i / 6, 0, (i + 1) / 6, 1 / 1);
    }

    let Mesh = BABYLON.MeshBuilder
        .CreateBox(
            id, {
                faceUV: faceUV,
                wrap: true,
                size: Settings.size,
            });
    Mesh.material = mat;

    if (Settings.Shadows) {
        for (let i=Settings.Shadows.length-1; i>-1; i--) {
            Settings.Shadows[i].addShadowCaster(Mesh);
        }
    }

    return Mesh;
};
