/*

&3d.animator.SkipAnimation=1
    skip animation by forcing last frame immediately

*/

const AnimatorSetup = (Arena) => {
    let AnimGroups = {};

    const urlParams = new URLSearchParams(window.location.search);

    let SkipAnimation = urlParams.get("3d.animator.SkipAnimation") || false;

    const isPlaying = (id) => {
        id = "" + id;

        if (!(id in AnimGroups)) return false;
        if (!AnimGroups[id]) return false;

        return AnimGroups[id].isPlaying;
    };

    const Animate = (id, Actor, Pairs, lastframe, framerate) => {
        id = "" + id;

        if (!lastframe) lastframe = Arena.World.framerate; // default: 1-sec
        if (!framerate) framerate = Arena.World.framerate;

        if (SkipAnimation) lastframe = 0;

        if (AnimGroups[id]) AnimGroups[id].stop();

        let Anims = [];

        for (let prop of Object.keys(Pairs)) {
            let animtype = BABYLON.Animation.ANIMATIONTYPE_FLOAT,
                isVector = false;

            if (["target", "position", "rotation"].includes(prop)) {
                animtype = BABYLON.Animation.ANIMATIONTYPE_VECTOR3;
                isVector = true;
            }

            let StartValue = Actor[prop],
                EndValue = Pairs[prop];

            if (prop == "rotation") {
                // dev: prevent rotation flip from angle conversion
                let rotY = Math.abs(StartValue.y - EndValue.y);
                if (rotY > Math.PI) {
                    Actor[prop] = Pairs[prop];
                    continue;
                }
            }

            if (prop == "radius") {
                // dev: prevent animate from exceeding preset camera limits
                //  may occur on calculateFit for some meshes
                if (Actor.upperRadiusLimit
                        && EndValue > Actor.upperRadiusLimit) {
                    console.log("set camera upperRadiusLimit: ", EndValue);
                    Actor.upperRadiusLimit = EndValue;
                }
            }

            if (!isVector && StartValue == EndValue) {
                continue;
            } else if (isVector && StartValue.equals(EndValue)) {
                continue;
            }

            let Anim = new BABYLON.Animation(
                    id + prop, prop, framerate, animtype),
                Keys = [
                    { frame : 0, value : StartValue },
                    { frame : lastframe, value : EndValue }
                ];
            Anim.setKeys(Keys);

            Anims.push(Anim);
        }

        if (Anims.length > 0) {
            AnimGroups[id] = new BABYLON.AnimationGroup(id);
            for (let i=Anims.length-1; i>-1; i--) {
                AnimGroups[id].addTargetedAnimation(Anims[i], Actor);
            }

            AnimGroups[id].onAnimationGroupEndObservable.add(() => {
                AnimGroups[id].dispose();
                delete AnimGroups[id];
            });

            AnimGroups[id].play();

            return true;
        }

        return false;
    }

    return {
        Animate: Animate,
        isPlaying: isPlaying,
    }
}
