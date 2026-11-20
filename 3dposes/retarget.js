import { Matrix4, Quaternion, Vector3 } from 'three';

// Target joints follow the world rotation of the corresponding CMU joint.
// Bind transforms preserve each skeleton's joint axes and limb proportions.
const joints = [
  ['pelvis', 'Hips'], ['spine_01', 'Spine'], ['spine_02', 'Spine1'],
  ['spine_03', 'Spine2'], ['neck_01', 'Neck'], ['Head', 'Head']
];
for (const [suffix, side] of [['l', 'Left'], ['r', 'Right']]) {
  for (const [source, target] of [
    ['clavicle', 'Shoulder'], ['upperarm', 'Arm'], ['lowerarm', 'ForeArm'], ['hand', 'Hand'],
    ['thigh', 'UpLeg'], ['calf', 'Leg'], ['foot', 'Foot'], ['ball', 'ToeBase']
  ]) joints.push([source + '_' + suffix, side + target]);
}

const bindMatrix = new Matrix4();
const world = new Quaternion();
const local = new Quaternion();
const correction = new Quaternion();
const parent = new Quaternion();
const position = new Vector3();

function bindTransforms(root) {
  root.updateWorldMatrix(true, true);
  const mesh = root.getObjectsByProperty('isSkinnedMesh', true).sort((a, b) =>
    b.skeleton.bones.length - a.skeleton.bones.length ||
    b.geometry.attributes.position.count - a.geometry.attributes.position.count)[0];
  const meshToModel = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  const skin = mesh.skeleton;
  return new Map(skin.bones.map((bone, i) =>
    [bone, meshToModel.clone().multiply(skin.boneInverses[i].clone().invert())]));
}

function bindRotation(bind, joint) {
  return new Quaternion().setFromRotationMatrix(bindMatrix.extractRotation(bind.get(joint))).normalize();
}

function bindPosition(bind, joint) {
  return new Vector3().setFromMatrixPosition(bind.get(joint));
}

function hipHeading(root, bind, left, right) {
  const side = bindPosition(bind, root.getObjectByName(left))
    .sub(bindPosition(bind, root.getObjectByName(right)));
  return Math.atan2(side.x, side.z);
}

function alignBindDirection(source, target, sourceBind, targetBind) {
  const nextPair = joints.find(([a, b]) =>
    source.getObjectByName(a)?.parent === source && target.getObjectByName(b)?.parent === target);
  if (!nextPair || ['pelvis', 'Head'].includes(source.name)) return correction.identity();
  const sourceDir = bindPosition(sourceBind, source.getObjectByName(nextPair[0]))
    .sub(bindPosition(sourceBind, source)).normalize();
  const targetDir = bindPosition(targetBind, target.getObjectByName(nextPair[1]))
    .sub(bindPosition(targetBind, target)).normalize();
  return correction.setFromUnitVectors(targetDir, sourceDir);
}

export function createRetargeter(source, avatar) {
  source.updateMatrixWorld(true);
  const sourceBind = new Map(source.getObjectsByProperty('isBone', true)
    .map(bone => [bone, bone.matrixWorld.clone()]));
  const targetBind = bindTransforms(avatar);
  // The female mesh's bind pose faces +X, while the CMU rig faces +Z.
  // Align their hip axes before deriving the per-joint rotation offsets.
  const headingOffset = hipHeading(source, sourceBind, 'thigh_l', 'thigh_r')
    - hipHeading(avatar, targetBind, 'LeftUpLeg', 'RightUpLeg');
  const alignHeading = new Matrix4().makeRotationY(headingOffset);
  for (const matrix of targetBind.values()) matrix.premultiply(alignHeading);
  const sourceHips = source.getObjectByName('pelvis');
  const targetHips = avatar.getObjectByName('Hips');
  const sourceRest = bindPosition(sourceBind, sourceHips);
  const targetRest = bindPosition(targetBind, targetHips);
  const targetScale = avatar.scale.x;
  const heightRatio = targetRest.y * targetScale / sourceRest.y;

  const mappings = joints.map(([from, to]) => {
    const src = source.getObjectByName(from);
    const dst = avatar.getObjectByName(to);
    const restOffset = bindRotation(sourceBind, src).invert()
      .multiply(alignBindDirection(src, dst, sourceBind, targetBind))
      .multiply(bindRotation(targetBind, dst));
    return { src, dst, restOffset };
  });
  let origin;

  return {
    apply() {
      source.updateMatrixWorld(true);
      sourceHips.getWorldPosition(position);
      origin ??= new Vector3(position.x, sourceRest.y, position.z);
      position.sub(origin).multiplyScalar(heightRatio);
      position.y += targetRest.y * targetScale;
      targetHips.parent.worldToLocal(position);
      targetHips.position.copy(position);
      for (const { src, dst, restOffset } of mappings) {
        src.getWorldQuaternion(world).multiply(restOffset);
        dst.parent.getWorldQuaternion(parent);
        dst.quaternion.copy(local.copy(parent).invert().multiply(world).normalize());
      }
    }
  };
}
