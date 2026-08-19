/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { XonoticGameState, Bot, Projectile, PickupItem } from '../game/xonoticTypes';
import { getXonoticMap, generateStreamedChunk, isHubChunk, chunkKey, CHUNK_SIZE, CHUNK_LOAD_RADIUS, ESCAPE_WALL_ID, getPuddles, PUDDLE_COLOR, WALL_H } from '../game/xonoticMap';

// Helper to build procedural low-poly Demogorgon models — the single Backrooms monster
function buildDemogorgonModel(bot: Bot): THREE.Group {
  const group = new THREE.Group();
  const indexStr = bot.id.replace('enemy_', '');
  const index = parseInt(indexStr, 10) || 0;
  const isStrong = bot.name.includes('우두머리') || bot.name.includes('강한');

  // Base materials helper
  const createMat = (colorStr: string, roughness = 0.8, metalness = 0.1) => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorStr),
      roughness: roughness,
      metalness: metalness,
    });
  };

  // Demogorgon skin — pure jet-black shadow-creature variations (subtle value shifts only, no hue)
  const fleshColors = [
    '#0a0a0a', // Near-pure black
    '#111111', // Charcoal black
    '#060606', // Void black
    '#161616', // Sooty black
  ];
  const demoSkinColor = fleshColors[index % fleshColors.length];
  
  // Glistening skin: lower roughness, higher metalness/specular look
  const skinMat = createMat(demoSkinColor, 0.45, 0.22); 

  const rawBloodMat = createMat('#04000a', 0.28, 0.05);  // Wet inner tissue, black with a faint cold hint
  const petalInnerMat = createMat('#0d0308', 0.35, 0.05); // Blackened petal interior
  const toxicSlimeMat = createMat('#052b12', 0.2, 0.4);   // Near-black glowing spores
  const boneMat = createMat('#e8e8e8', 0.8, 0.0);         // Bone-white teeth, kept for scary contrast against the black body
  const clawMat = createMat('#000000', 0.3, 0.7);         // Obsidian black claws
  
  // Glistening dynamic saliva/slime material
  const salivaMat = new THREE.MeshStandardMaterial({
    color: '#0d1a0d',
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55
  });

  // 1. TORSO (Highly detailed, subdivided, gangly creature torso with organic flank plates, clavicles, muscle plating, and scary skin patterns/stripes)
  const torsoGroup = new THREE.Group();
  torsoGroup.name = 'torso';

  const bodyW = isStrong ? 0.75 : 0.52;
  const bodyH = isStrong ? 1.45 : 1.20;
  const bodyD = isStrong ? 0.42 : 0.30;
  const armW = isStrong ? 0.14 : 0.095; // fleshy, muscular predator arms
  const armL = isStrong ? 2.15 : 2.2;   // extremely long, scary limbs
  
  // Basal slender skeletal core of the torso
  const torsoGeo = new THREE.BoxGeometry(bodyW * 0.9, bodyH, bodyD * 0.9);
  const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // Creepy back spine/vertebrae (prominent bony ridges along the hunched back)
  const spineCount = 6;
  for (let sIdx = 0; sIdx < spineCount; sIdx++) {
    const sRatio = sIdx / (spineCount - 1);
    const sY = -bodyH * 0.35 + sRatio * bodyH * 0.7;
    const vertebra = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.06), boneMat);
    vertebra.position.set(0, sY, -bodyD / 2 - 0.012);
    const sScale = 1.0 + Math.sin(sRatio * Math.PI) * 0.35;
    vertebra.scale.set(sScale, sScale, sScale);
    vertebra.castShadow = true;
    torsoMesh.add(vertebra);
  }

  // Subdivided Anatomy: Chest Pectoral Muscles (left/right plates)
  const pecW = bodyW * 0.36;
  const pecH = bodyH * 0.22;
  const pecD = 0.06;
  
  const pecL = new THREE.Mesh(new THREE.BoxGeometry(pecW, pecH, pecD), skinMat);
  pecL.position.set(-bodyW * 0.24, bodyH * 0.22, bodyD / 2.1);
  pecL.rotation.y = -0.15;
  pecL.rotation.z = -0.05;
  pecL.castShadow = true;
  pecL.receiveShadow = true;
  torsoMesh.add(pecL);
  
  const pecR = new THREE.Mesh(new THREE.BoxGeometry(pecW, pecH, pecD), skinMat);
  pecR.position.set(bodyW * 0.24, bodyH * 0.22, bodyD / 2.1);
  pecR.rotation.y = 0.15;
  pecR.rotation.z = 0.05;
  pecR.castShadow = true;
  pecR.receiveShadow = true;
  torsoMesh.add(pecR);

  // Subdivided Anatomy: 6 Abdominal muscle plates (high density look)
  const abW = bodyW * 0.3;
  const abH = bodyH * 0.08;
  const abD = 0.05;
  const abYPositions = [bodyH * 0.03, -bodyH * 0.08, -bodyH * 0.19];
  
  abYPositions.forEach((pY) => {
    const abPlateL = new THREE.Mesh(new THREE.BoxGeometry(abW, abH, abD), skinMat);
    abPlateL.position.set(-bodyW * 0.21, pY, bodyD / 2.1);
    abPlateL.rotation.y = -0.1;
    abPlateL.castShadow = true;
    abPlateL.receiveShadow = true;
    torsoMesh.add(abPlateL);

    const abPlateR = new THREE.Mesh(new THREE.BoxGeometry(abW, abH, abD), skinMat);
    abPlateR.position.set(bodyW * 0.21, pY, bodyD / 2.1);
    abPlateR.rotation.y = 0.1;
    abPlateR.castShadow = true;
    abPlateR.receiveShadow = true;
    torsoMesh.add(abPlateR);
  });

  // Lateral flank ribs / Oblique muscle plates (giving detailed body contours)
  const flankCount = 4;
  for (let f = 0; f < flankCount; f++) {
    const fY = -bodyH * 0.25 + f * 0.16;
    const flankW = 0.06;
    const flankH = bodyH * 0.045;
    const flankD = bodyD * 0.52;
    
    const flankSegmentL = new THREE.Mesh(new THREE.BoxGeometry(flankW, flankH, flankD), skinMat);
    flankSegmentL.position.set(-bodyW / 2, fY, 0);
    flankSegmentL.rotation.z = -0.25;
    flankSegmentL.rotation.x = 0.15;
    flankSegmentL.castShadow = true;
    torsoMesh.add(flankSegmentL);

    const flankSegmentR = new THREE.Mesh(new THREE.BoxGeometry(flankW, flankH, flankD), skinMat);
    flankSegmentR.position.set(bodyW / 2, fY, 0);
    flankSegmentR.rotation.z = 0.25;
    flankSegmentR.rotation.x = 0.15;
    flankSegmentR.castShadow = true;
    torsoMesh.add(flankSegmentR);
  }

  // Deltoid shoulder muscle joint overlays
  const shoulderS = armW * 1.5;
  const shoulderPadL = new THREE.Mesh(new THREE.BoxGeometry(shoulderS, shoulderS * 1.2, shoulderS), skinMat);
  shoulderPadL.position.set(-bodyW * 0.48, bodyH * 0.32, 0.02);
  shoulderPadL.rotation.z = -0.18;
  torsoMesh.add(shoulderPadL);

  const shoulderPadR = new THREE.Mesh(new THREE.BoxGeometry(shoulderS, shoulderS * 1.2, shoulderS), skinMat);
  shoulderPadR.position.set(bodyW * 0.48, bodyH * 0.32, 0.02);
  shoulderPadR.rotation.z = 0.18;
  torsoMesh.add(shoulderPadR);

  const basePosY = isStrong ? 2.10 : 2.06; // raised hips to fit lanky legs standing cleanly on the floor
  const theta = 0.48; // Menacing animalistic hunched/bent back angle (around 27 degrees)
  
  // Pivot around bottom of torso so it aligns cleanly to the hips at z=0, y=basePosY
  const torsoY = basePosY + (bodyH / 2) * Math.cos(theta);
  const torsoZ = (bodyH / 2) * Math.sin(theta);
  torsoGroup.position.set(0, torsoY, torsoZ);
  torsoGroup.rotation.x = theta;
  group.add(torsoGroup);

  // 2. HEAD (Blooming 5-Petal Flower Mouth, Dual Tooth Rows and Glistening Saliva strings)
  const headGroup = new THREE.Group();
  headGroup.name = 'head';

  const headS = isStrong ? 0.62 : 0.46;
  // Deep biological core inside the faceless head
  const headCoreGeo = new THREE.BoxGeometry(headS, headS, headS);
  const headCore = new THREE.Mesh(headCoreGeo, rawBloodMat);
  headCore.castShadow = true;
  headGroup.add(headCore);

  // Concentric throat teeth vortex inside the central head core representing hyper-fine bone segmentations
  const throatTeethCount = 12;
  for (let vt = 0; vt < throatTeethCount; vt++) {
    const angle = (vt / throatTeethCount) * Math.PI * 2;
    const rad = headS * 0.22;
    const vToothGeo = new THREE.ConeGeometry(0.015, 0.065, 4);
    vToothGeo.rotateX(Math.PI / 2);
    const vTooth = new THREE.Mesh(vToothGeo, boneMat);
    vTooth.position.set(Math.cos(angle) * rad, Math.sin(angle) * rad, headS / 2 - 0.01);
    vTooth.lookAt(new THREE.Vector3(0, 0, headS / 2 + 0.1));
    vTooth.rotation.z += Math.PI;
    headGroup.add(vTooth);
  }

  // Neck connecting head to torso with organic details matching the pure skin surface
  const neckW = isStrong ? 0.22 : 0.17;
  const neckGeo = new THREE.BoxGeometry(neckW, 0.32, neckW);
  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.position.set(0, -headS / 2 - 0.08, -0.04);
  headGroup.add(neckMesh);

  // Muscle cords on sides of neck (now matching the clean skinMat!)
  const muscleOffset = isStrong ? 0.11 : 0.085;
  const muscleL = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.045), skinMat);
  muscleL.position.set(-muscleOffset, -headS / 2 - 0.08, -0.02);
  muscleL.rotation.z = 0.15;
  headGroup.add(muscleL);

  const muscleR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.045), skinMat);
  muscleR.position.set(muscleOffset, -headS / 2 - 0.08, -0.02);
  muscleR.rotation.z = -0.15;
  headGroup.add(muscleR);

  // Dark void/throat cavity at the center (no fake glowing eyes)
  const throatMat = new THREE.MeshStandardMaterial({ color: '#140204', roughness: 0.9, metalness: 0.1 });
  const throatCavity = new THREE.Mesh(new THREE.SphereGeometry(headS * 0.28, 8, 8), throatMat);
  throatCavity.position.set(0, 0, headS / 2.1 - 0.04);
  headGroup.add(throatCavity);

  // Petals Data (Top, Left, Right, Bottom-Left, Bottom-Right)
  // Fully bloomed configuration (splayed outwards like a magnificent blooming flower)
  const petalData = [
    { name: 'petal_top', pos: [0, headS * 0.75, headS * 0.22], rot: [-1.22, 0, 0], w: headS * 0.8, h: headS * 1.15, d: 0.06 },
    { name: 'petal_left', pos: [-headS * 0.75, headS * 0.1, headS * 0.22], rot: [0, 1.22, 0.45], w: headS * 1.15, h: headS * 0.8, d: 0.06 },
    { name: 'petal_right', pos: [headS * 0.75, headS * 0.1, headS * 0.22], rot: [0, -1.22, -0.45], w: headS * 1.15, h: headS * 0.8, d: 0.06 },
    { name: 'petal_bot_l', pos: [-headS * 0.52, -headS * 0.62, headS * 0.22], rot: [1.12, 0.38, -0.38], w: headS * 0.75, h: headS * 0.75, d: 0.06 },
    { name: 'petal_bot_r', pos: [headS * 0.52, -headS * 0.62, headS * 0.22], rot: [1.12, -0.38, 0.38], w: headS * 0.75, h: headS * 0.75, d: 0.06 },
  ];

  petalData.forEach(p => {
    const petalSubGroup = new THREE.Group();
    petalSubGroup.name = p.name;
    petalSubGroup.position.set(p.pos[0], p.pos[1], p.pos[2]);
    petalSubGroup.rotation.set(p.rot[0], p.rot[1], p.rot[2]);

    petalSubGroup.userData = { baseRot: [...p.rot] };

    // a) Outer epidermal skin plate (Symmetrical, clean, highly detailed skin surface)
    const outerGeo = new THREE.BoxGeometry(p.w, p.h, p.d);
    const outerSeg = new THREE.Mesh(outerGeo, skinMat);
    outerSeg.castShadow = true;
    outerSeg.receiveShadow = true;
    petalSubGroup.add(outerSeg);

    // b) Inner fleshy surface
    const innerGeo = new THREE.BoxGeometry(p.w * 0.9, p.h * 0.95, 0.02);
    const innerSeg = new THREE.Mesh(innerGeo, petalInnerMat);
    innerSeg.position.set(0, 0, p.d / 2 + 0.008);
    innerSeg.castShadow = true;
    innerSeg.receiveShadow = true;
    petalSubGroup.add(innerSeg);

    // c) Outer row white bone teeth
    const segOuterTeeth = isStrong ? 4 : 3;
    for (let t = 0; t < segOuterTeeth; t++) {
      const toothGeo = new THREE.ConeGeometry(0.018, 0.08, 4);
      toothGeo.rotateX(Math.PI / 2);
      const tooth = new THREE.Mesh(toothGeo, boneMat);
      const offsetFactor = (t / (segOuterTeeth - 1 || 1)) * 2 - 1;
      
      tooth.position.set(
        p.w > p.h ? offsetFactor * p.w * 0.42 : 0,
        p.h > p.w ? offsetFactor * p.h * 0.42 : 0,
        p.d / 2 + 0.04
      );
      petalSubGroup.add(tooth);
    }

    // d) Inner row yellow teeth
    const segInnerTeeth = isStrong ? 3 : 2;
    const yellowBoneMat = createMat('#3a3a3a', 0.65); // dark inner teeth — kept slightly off-black from the outer white fangs
    for (let t = 0; t < segInnerTeeth; t++) {
      const toothGeo = new THREE.ConeGeometry(0.013, 0.055, 4);
      toothGeo.rotateX(Math.PI / 2 + 0.22);
      const tooth = new THREE.Mesh(toothGeo, yellowBoneMat);
      const offsetFactor = (t / (segInnerTeeth - 1 || 1)) * 2 - 1;
      
      tooth.position.set(
        p.w > p.h ? offsetFactor * p.w * 0.28 : 0,
        p.h > p.w ? offsetFactor * p.h * 0.28 : 0,
        p.d / 2 + 0.018
      );
      petalSubGroup.add(tooth);
    }

    headGroup.add(petalSubGroup);
  });

  // Glistening Saliva strings: translucent webs dangling organically inside the gaping center
  const slimeCount = 6; // increased density of drool
  for (let s = 0; s < slimeCount; s++) {
    const slimeGeo = new THREE.CylinderGeometry(0.006, 0.006, headS * 0.95, 4);
    const salivaSpline = new THREE.Mesh(slimeGeo, salivaMat);
    salivaSpline.rotation.z = Math.PI / 4 + (s * Math.PI / 7);
    salivaSpline.rotation.x = Math.PI / 6 * (s % 2 === 0 ? 1 : -1);
    salivaSpline.position.set(Math.sin(s) * 0.06, Math.cos(s) * 0.06, headS * 0.45);
    headGroup.add(salivaSpline);
  }

  // Position head group onto the now hunched torso (rotating the offset relative to torsoGroup)
  const dyHead = bodyH / 2 + (headS / 2) + 0.02;
  const dzHead = 0.08;
  const headY = torsoGroup.position.y + dyHead * Math.cos(theta) - dzHead * Math.sin(theta);
  const headZ = torsoGroup.position.z + dyHead * Math.sin(theta) + dzHead * Math.cos(theta);
  headGroup.position.set(0, headY, headZ);
  headGroup.rotation.set(0.24, 0.0, 0.0); // Facing straight/forward
  group.add(headGroup);

  // 3. ARMS (Extremely creepy multi-segmented arms with double joints and scary claws!)

  // Let's make Left and Right arms multi-segmented: Thigh-Shoulder, Forearm, Hand, Long spindly fingers
  const buildRealisticArm = (isLeft: boolean) => {
    const armGroup = new THREE.Group();
    armGroup.name = isLeft ? 'arm_left' : 'arm_right';

    const dirSign = isLeft ? -1 : 1;

    // Segment A: Upper Arm
    const upperArmH = armL * 0.48;
    const upperArm = new THREE.Mesh(new THREE.BoxGeometry(armW * 1.15, upperArmH, armW * 1.15), skinMat);
    upperArm.castShadow = true;
    upperArm.position.y = -upperArmH / 2;
    armGroup.add(upperArm);

    // Elbow Joint (bony protruding bulb - matching skinMat for clean look, no red spots!)
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(armW * 0.68, 6, 6), skinMat);
    elbow.position.set(0, -upperArmH, 0);
    armGroup.add(elbow);

    // Segment B: Forearm (longer and thinner)
    const forearmH = armL * 0.52;
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -upperArmH, 0);
    // Menacing bent-elbow predator pose
    forearmGroup.rotation.x = -1.15; 

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(armW * 0.85, forearmH, armW * 0.85), skinMat);
    forearm.castShadow = true;
    forearm.position.y = -forearmH / 2;
    forearmGroup.add(forearm);

    // Hand wrist node (matching skinMat for clean look, no red spots!)
    const handNode = new THREE.Mesh(new THREE.SphereGeometry(armW * 0.55, 6, 6), skinMat);
    handNode.position.set(0, -forearmH, 0);
    forearmGroup.add(handNode);

    // Elongated spindly splayed fingers (4 long clawed bone fingers per arm)
    const fingerAngles = [-0.35, -0.12, 0.12, 0.35];
    fingerAngles.forEach((fAngle, fIdx) => {
      const fingerGroup = new THREE.Group();
      fingerGroup.position.set(dirSign * fAngle * 0.12, -forearmH - 0.02, 0);
      fingerGroup.rotation.y = fAngle;
      fingerGroup.rotation.x = 0.15 + (fIdx % 2 === 0 ? 0.1 : 0);

      // Finger section 1 (proximal bone)
      const fSegment1 = new THREE.Mesh(new THREE.BoxGeometry(armW * 0.22, armL * 0.18, armW * 0.22), skinMat);
      fSegment1.position.y = -armL * 0.09;
      fingerGroup.add(fSegment1);

      // Finger section 2 (distal bone)
      const fSegment2 = new THREE.Mesh(new THREE.BoxGeometry(armW * 0.16, armL * 0.14, armW * 0.16), skinMat);
      fSegment2.position.set(0, -armL * 0.18, -0.012);
      fSegment2.rotation.x = 0.25; // curved finger
      fingerGroup.add(fSegment2);

      // Claws (Obsidian black curved spikes!)
      const cGeo = new THREE.ConeGeometry(armW * 0.16, armL * 0.16, 4);
      cGeo.rotateX(Math.PI / 1.7); // bend claw inwards
      const claw = new THREE.Mesh(cGeo, clawMat);
      claw.position.set(0, -armL * 0.32, 0.04);
      fingerGroup.add(claw);

      forearmGroup.add(fingerGroup);
    });

    armGroup.add(forearmGroup);

    // Shoulder anchor position on Torso (aligned with hunched posture)
    const posX = dirSign * (bodyW / 2 + armW / 0.95); // Spaced out further for a wide posture (쩍팔)
    const dyArm = bodyH / 2 - 0.15;
    const dzArm = 0.05;
    const armY = torsoGroup.position.y + dyArm * Math.cos(theta) - dzArm * Math.sin(theta);
    const armZ = torsoGroup.position.z + dyArm * Math.sin(theta) + dzArm * Math.cos(theta);
    armGroup.position.set(posX, armY, armZ);

    // Terrifying natural predator splayed-out clawing pose (shoulder spread and raised forward)
    armGroup.rotation.set(-Math.PI / 6, dirSign * 0.45, dirSign * 0.75); // dirSign * 0.75 to splay outward wide (쩍팔)!

    return armGroup;
  };

  group.add(buildRealisticArm(true));  // Left arm
  group.add(buildRealisticArm(false)); // Right arm

  // 4. LEGS (Extremely realistic digitigrade animal structure: Hip -> Thigh -> Knee -> Forward Calf -> Foot)
  const legW = isStrong ? 0.16 : 0.11;  // beefy powerful powerful digitigrade leg segments
  const legH = isStrong ? 2.45 : 2.50;  // extremely long intimidating legs (increased slightly as requested)

  const buildRealisticLeg = (isLeft: boolean) => {
    const legGroup = new THREE.Group();
    legGroup.name = isLeft ? 'leg_left' : 'leg_right';

    const dirSign = isLeft ? -1 : 1;

    // Segment A: Hip ball/joint (matching skinMat, no red spots!)
    const hip = new THREE.Mesh(new THREE.SphereGeometry(legW * 0.72, 6, 6), skinMat);
    hip.position.set(0, 0, 0);
    legGroup.add(hip);

    // Segment B: Thigh (Leans backwards)
    const thighH = legH * 0.42;
    const thighGroup = new THREE.Group();
    thighGroup.rotation.x = 0.4; // back angle for digitigrade look!
    
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(legW * 1.25, thighH, legW * 1.25), skinMat);
    thigh.castShadow = true;
    thigh.position.y = -thighH / 2;
    thighGroup.add(thigh);

    // Knee joint (bony caps - matching skinMat, no red spots!)
    const knee = new THREE.Mesh(new THREE.SphereGeometry(legW * 0.65, 6, 6), skinMat);
    knee.position.set(0, -thighH, 0);
    thighGroup.add(knee);

    // Segment C: Calf/Shin (Leans forward)
    const calfH = legH * 0.45;
    const calfGroup = new THREE.Group();
    calfGroup.position.set(0, -thighH, 0);
    calfGroup.rotation.x = -0.75; // forward angle!

    const calf = new THREE.Mesh(new THREE.BoxGeometry(legW * 0.92, calfH, legW * 0.92), skinMat);
    calf.castShadow = true;
    calf.position.y = -calfH / 2;
    calfGroup.add(calf);

    // Heel spike bone!
    const heelSpike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 4), boneMat);
    heelSpike.rotateX(-Math.PI / 3);
    heelSpike.position.set(0, -calfH, -legW * 0.45);
    calfGroup.add(heelSpike);

    // Segment D: Foot / Toes (Attaches at ankle bone)
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -calfH, 0);
    footGroup.rotation.x = 0.355; // level foot with ground

    // 3 Splayed sharp claw toes
    const toeAngles = [-0.25, 0, 0.25];
    toeAngles.forEach(tAngle => {
      const toeSubGroup = new THREE.Group();
      toeSubGroup.rotation.y = tAngle;

      const toeBone = new THREE.Mesh(new THREE.BoxGeometry(legW * 0.28, 0.05, legH * 0.25), skinMat);
      toeBone.position.set(0, -0.01, legH * 0.1);
      toeSubGroup.add(toeBone);

      // Curved nail claw
      const nailGeo = new THREE.ConeGeometry(0.024, 0.12, 4);
      nailGeo.rotateX(Math.PI / 1.8);
      const nail = new THREE.Mesh(nailGeo, clawMat);
      nail.position.set(0, -0.01, legH * 0.22);
      toeSubGroup.add(nail);

      footGroup.add(toeSubGroup);
    });

    calfGroup.add(footGroup);
    thighGroup.add(calfGroup);
    legGroup.add(thighGroup);

    // Attach to Torso bottom (Spaced out widely for "쩍벌" stance)
    legGroup.position.set(dirSign * (bodyW / 1.7), basePosY - 0.05, 0);
    legGroup.rotation.z = dirSign * 0.32; // Wide stance leg splay (쩍벌)

    return legGroup;
  };

  group.add(buildRealisticLeg(true));  // Left leg
  group.add(buildRealisticLeg(false)); // Right leg

  // Cache baseline transforms for animation loop
  group.userData = { 
    headBaseY: headGroup.position.y,
    armLBaseRotX: -Math.PI / 6,
    armRBaseRotX: -Math.PI / 6,
    armLBaseRotY: -0.45,
    armRBaseRotY: 0.45,
    armLBaseRotZ: -0.75, // splayed outwards
    armRBaseRotZ: 0.75,  // splayed outwards
    legLBaseRotX: 0,
    legRBaseRotX: 0,
    legLBaseRotZ: -0.32, // splayed wide (쩍벌)
    legRBaseRotZ: 0.32,  // splayed wide (쩍벌)
    bodyBaseY: basePosY,
    isBoss: isStrong
  };

  // Height comes from genuinely longer legs/arms (legH, armL, basePosY above), not from scaling the
  // whole rig up — scaling here just floats the model since bot.pos.y's render offset assumes this
  // base scale. Boss model has larger proportions (legH/bodyH bigger), so needs smaller scale to
  // match the same relative height.
  group.scale.setScalar(isStrong ? 0.60 : 0.75);

  return group;
}

// Builds a blue armored human figure for remote online players
function buildRemotePlayerModel(bot: Bot): THREE.Group {
  const group = new THREE.Group();
  const mat = (color: string, emissive = '#000000') =>
    new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.4, metalness: 0.6 });

  // Body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.28), mat('#1d4ed8', '#1e3a8a'));
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  // Chest stripe (cyan accent)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.3), mat('#06b6d4', '#0e7490'));
  stripe.position.y = 1.05;
  group.add(stripe);

  // Head (helmet)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), mat('#1e40af', '#1e3a8a'));
  head.position.y = 1.65;
  head.castShadow = true;
  group.add(head);

  // Visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), mat('#67e8f9', '#22d3ee'));
  visor.position.set(0, 1.67, 0.2);
  group.add(visor);

  // Shoulder pads
  [-0.37, 0.37].forEach((x) => {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.28), mat('#1d4ed8'));
    pad.position.set(x, 1.35, 0);
    group.add(pad);
  });

  // Arms
  [-0.38, 0.38].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), mat('#1e3a8a'));
    arm.position.set(x, 0.88, 0);
    arm.castShadow = true;
    group.add(arm);
  });

  // Legs
  [-0.16, 0.16].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), mat('#1e3a8a'));
    leg.position.set(x, 0.35, 0);
    leg.castShadow = true;
    group.add(leg);
  });

  // Name label sprite above head
  const canvas2d = document.createElement('canvas');
  canvas2d.width = 256;
  canvas2d.height = 64;
  const ctx = canvas2d.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(4, 4, 248, 56);
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = '#67e8f9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(bot.name.slice(0, 16), 128, 34);
  const tex = new THREE.CanvasTexture(canvas2d);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.8, 0.45, 1);
  sprite.position.y = 2.35;
  group.add(sprite);

  return group;
}

// Deep recursive disposal helper to prevent WebGL memory leaks on dynamic bot/projectile spawns
const disposeHierarchy = (obj: THREE.Object3D) => {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => mat.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
  });
};

interface XonoticCanvasProps {
  state: XonoticGameState;
  gameStateRef?: React.RefObject<XonoticGameState | null>;
  onPointerLockChange: (locked: boolean) => void;
  onMouseMove: (dx: number, dy: number) => void;
}

export const XonoticCanvas: React.FC<XonoticCanvasProps> = React.memo(({
  state,
  gameStateRef,
  onPointerLockChange,
  onMouseMove,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Visual Meshes caching is now stored directly as local variables inside the unified useEffect for maximum performance and stability.
  const [isLocked, setIsLocked] = useState(false);
  const [isManualActive, setIsManualActive] = useState(false);

  // Fallback Drag mechanics refs
  const isMouseDownRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // References to keep camera, scene, renderer available for global handlers if needed
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Keep a reference to the latest game state to bypass React state-update throttling
  const stateRef = useRef(state);
  stateRef.current = state; // Sync immediately inside render body!

  // Unified Scene, Lights, Map, and high-performance render loop
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Create Scene & the sickly fluorescent-lit Backrooms haze
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#8a7f4a'); // hazy mustard-yellow backrooms air
    scene.fog = new THREE.FogExp2('#7a6f42', 0.006); // thicker haze — corridors vanish into the same murk
    sceneRef.current = scene;

    // 2. Camera Setup (Generous 85-degree Quake-style Field of View)
    const camera = new THREE.PerspectiveCamera(85, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraRef.current = camera;

    // 3. WebGL Renderer Setup - use high-performance power preference for discrete GPU priority
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Optimizing pixel ratio to 1.5 to dramatically improve performance on 4K/Retina displays
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Beautiful soft shadows
    
    // Clear any leftover elements just in case, then append
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting Rig (flat, oppressive buzzing-fluorescent illumination — no directional "sun" feel).
    // Kept dim on purpose: real brightness comes from the roaming fixture-light pool below, which
    // pools light under nearby fluorescent tubes and lets everywhere else actually read as dark.
    // Cut way down from the old 0.55/0.4 — real Backrooms photos go near-black between fluorescent
    // tubes, and this base wash was flattening that out. Just enough left that pitch-black stretches
    // still read as navigable geometry instead of a void.
    const ambientLight = new THREE.AmbientLight('#fef9c3', 0.12); // barely-there base wash — unlit stretches read as genuinely dark
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#fdf6b2', 0.08); // near-negligible overhead fill, no harsh directional sun
    dirLight.position.set(30, 80, 30);
    dirLight.castShadow = false; // no sun-like directional shadow — flat fluorescent look only
    scene.add(dirLight);

    // A fixed-size pool of point lights that snap to the nearest fluorescent fixtures around the
    // player every frame (see updateFixtureLights below). Bounded cost regardless of map size —
    // real per-fixture lights would mean hundreds active across the infinite streamed maze.
    // Boosted intensity/reach so the areas that ARE lit read as genuinely bright — the contrast
    // against the now much dimmer base is what sells "dark areas are dark, lit ones aren't".
    const FIXTURE_LIGHT_POOL_SIZE = 10;
    const fixtureLights: THREE.PointLight[] = Array.from({ length: FIXTURE_LIGHT_POOL_SIZE }, () => {
      const light = new THREE.PointLight('#fef9c3', 13, 19, 2);
      light.visible = false;
      scene.add(light);
      return light;
    });

    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#D2B48C'),
      roughness: 0.92,
      metalness: 0.0,
    });

    // Procedural damp-wallpaper texture — a flat single color read as dull/lifeless across long
    // corridors, so this breaks it up with fine grain + blotchy stains. One shared texture reused
    // by every wall material (hub and infinite streamed maze alike), so it costs nothing extra per wall.
    const wallpaperTexture = (() => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#C9BE6D'; // bright yellow wallpaper base
      ctx.fillRect(0, 0, size, size);

      const imgData = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 16;
        imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + n));
        imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + n * 0.9));
        imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + n * 0.55));
      }
      ctx.putImageData(imgData, 0, 0);

      // Faint stains only — kept subtle so the wallpaper still reads as bright yellow overall
      for (let i = 0; i < 8; i++) {
        const sx = Math.random() * size;
        const sy = Math.random() * size;
        const r = 8 + Math.random() * 20;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        grad.addColorStop(0, 'rgba(120,105,50,0.10)');
        grad.addColorStop(1, 'rgba(120,105,50,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 2);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();

    // 5. Build static map geometry — the Backrooms: damp yellow wallpaper, popcorn ceilings, buzzing tubes
    const map = getXonoticMap();
    let escapeWallMesh: THREE.Mesh | null = null;
    map.walls.forEach(wall => {
      if (wall.collisionOnly) return; // Invisible collision-only walls
      const geometry = new THREE.BoxGeometry(wall.size.x, wall.size.y, wall.size.z);

      let material: THREE.Material;
      if (wall.id === 'floor_main') {
        material = floorMat;
      } else if (wall.id === 'ceiling_main') {
        // Stained popcorn ceiling — its own flat tone, not the bright wall wallpaper
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(wall.color),
          roughness: 0.95,
          metalness: 0.0,
        });
      } else if (wall.emissive) {
        // Buzzing fluorescent light fixtures
        material = new THREE.MeshBasicMaterial({ color: new THREE.Color(wall.color) });
      } else if (wall.flicker) {
        // The one escape wall — only subtly off from ordinary wallpaper up close (slightly cooler
        // tone, faint emissive) so a searching player can tell something's wrong on inspection, but
        // it doesn't glow like a beacon that gives its location away from across the map.
        material = new THREE.MeshStandardMaterial({
          color: '#e4d9a0',
          emissive: new THREE.Color('#fff3b0'),
          emissiveIntensity: 0.35,
          roughness: 0.6,
        });
      } else {
        // Bright yellow wallpaper with subtle grain/stain texture instead of a flat dead color —
        // material color left white so the texture's own bright color isn't tinted/darkened by
        // multiplying against a second muted color.
        material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: wallpaperTexture,
          roughness: 0.85,
          metalness: 0.0,
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(wall.pos.x, wall.pos.y, wall.pos.z);
      mesh.receiveShadow = !wall.emissive;
      mesh.castShadow = !wall.emissive;
      scene.add(mesh);
      if (wall.id === ESCAPE_WALL_ID) escapeWallMesh = mesh;
    });

    // Fixture positions feeding the roaming light pool — the static hub set, plus per-chunk sets
    // kept in sync as the infinite maze streams in/out below.
    const hubFixturePositions: { x: number; z: number }[] = map.walls
      .filter(w => w.emissive)
      .map(w => ({ x: w.pos.x, z: w.pos.z }));
    const chunkFixturePositions = new Map<string, { x: number; z: number }[]>();

    // 5c. Decorative, non-collidable puddles of contaminated standing water on the carpet
    const puddleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PUDDLE_COLOR),
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    });
    getPuddles().forEach(p => {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(p.radius, 16), puddleMat);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(p.x, 0.02, p.z);
      scene.add(puddle);
    });

    // 5b. Infinite streamed maze — beyond the hand-built hub above, chunks of the same yellow
    // Backrooms maze are generated/torn down on the fly around the player so the map never ends.
    // Materials are shared (not re-created per wall) since chunks load/unload constantly.
    const streamedWallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: wallpaperTexture, roughness: 0.85, metalness: 0.0 });
    const streamedCeilingMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#DCD7C8'), roughness: 0.95, metalness: 0.0 });
    const streamedLightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fef9c3') });
    const streamedFloorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#D2B48C'), roughness: 0.92, metalness: 0.0 });
    const streamedChunkMeshes = new Map<string, THREE.Mesh[]>();
    let lastStreamCx = Number.NaN;
    let lastStreamCz = Number.NaN;

    const disposeStreamedChunk = (key: string) => {
      const meshes = streamedChunkMeshes.get(key);
      if (!meshes) return;
      meshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
      });
      streamedChunkMeshes.delete(key);
      chunkFixturePositions.delete(key);
    };

    const loadStreamedChunk = (cx: number, cz: number) => {
      const key = chunkKey(cx, cz);
      if (streamedChunkMeshes.has(key)) return;
      const chunkWalls = generateStreamedChunk(cx, cz);
      const meshes: THREE.Mesh[] = chunkWalls.map(wall => {
        const geometry = new THREE.BoxGeometry(wall.size.x, wall.size.y, wall.size.z);
        const material = wall.id.startsWith('floor_') ? streamedFloorMat
          : wall.emissive ? streamedLightMat
          : wall.id.endsWith('_ceiling') ? streamedCeilingMat
          : streamedWallMat;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(wall.pos.x, wall.pos.y, wall.pos.z);
        mesh.receiveShadow = !wall.emissive;
        mesh.castShadow = !wall.emissive;
        scene.add(mesh);
        return mesh;
      });
      streamedChunkMeshes.set(key, meshes);
      chunkFixturePositions.set(key, chunkWalls.filter(w => w.emissive).map(w => ({ x: w.pos.x, z: w.pos.z })));
    };

    // Repositions the fixed-size fixture-light pool onto the N fluorescent fixtures nearest the
    // player each frame, so brightness pools under nearby tubes and drops off to the dim ambient
    // everywhere else — instead of one real light per fixture, which wouldn't scale to the
    // infinite streamed maze.
    const updateFixtureLights = (px: number, pz: number) => {
      const candidates = hubFixturePositions.concat(...chunkFixturePositions.values());
      candidates.sort((a, b) => {
        const da = (a.x - px) ** 2 + (a.z - pz) ** 2;
        const db = (b.x - px) ** 2 + (b.z - pz) ** 2;
        return da - db;
      });
      for (let i = 0; i < fixtureLights.length; i++) {
        const fixture = candidates[i];
        const light = fixtureLights[i];
        if (!fixture) { light.visible = false; continue; }
        light.visible = true;
        light.position.set(fixture.x, WALL_H - 1.2, fixture.z);
      }
    };

    // Loads/unloads chunks around the player's current position; cheap to call every frame since
    // it only does real work when the player has actually crossed into a new chunk.
    const updateStreamedChunks = (px: number, pz: number) => {
      const pcx = Math.floor(px / CHUNK_SIZE);
      const pcz = Math.floor(pz / CHUNK_SIZE);
      if (pcx === lastStreamCx && pcz === lastStreamCz) return;
      lastStreamCx = pcx;
      lastStreamCz = pcz;

      for (let dx = -CHUNK_LOAD_RADIUS; dx <= CHUNK_LOAD_RADIUS; dx++) {
        for (let dz = -CHUNK_LOAD_RADIUS; dz <= CHUNK_LOAD_RADIUS; dz++) {
          const cx = pcx + dx;
          const cz = pcz + dz;
          if (isHubChunk(cx, cz)) continue;
          loadStreamedChunk(cx, cz);
        }
      }

      const unloadDist = CHUNK_LOAD_RADIUS + 1;
      Array.from(streamedChunkMeshes.keys()).forEach(key => {
        const [cx, cz] = key.split('_').map(Number);
        if (Math.abs(cx - pcx) > unloadDist || Math.abs(cz - pcz) > unloadDist) {
          disposeStreamedChunk(key);
        }
      });
    };

    // 6. First-Person Viewmodel Gun Setup
    const gunGroup = new THREE.Group();
    
    const barrelGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.4, 12);
    barrelGeo.rotateX(Math.PI / 2);
    const barrelMat = new THREE.MeshStandardMaterial({ color: '#4b5563', metalness: 0.9, roughness: 0.1 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0, -1);
    gunGroup.add(barrel);

    const bodyGeo = new THREE.BoxGeometry(0.35, 0.35, 0.8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#1f2937', metalness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, -0.05, -0.5);
    gunGroup.add(body);

    const gunNeonGeo = new THREE.BoxGeometry(0.08, 0.08, 0.9);
    const gunNeonMat = new THREE.MeshBasicMaterial({ color: '#06b6d4' });
    const gunNeon = new THREE.Mesh(gunNeonGeo, gunNeonMat);
    gunNeon.position.set(0, 0.16, -0.6);
    gunGroup.add(gunNeon);

    const mFlashGeo = new THREE.SphereGeometry(0.24, 8, 8);
    const mFlashMat = new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.95 });
    const mFlash = new THREE.Mesh(mFlashGeo, mFlashMat);
    mFlash.position.set(0, 0, -1.8);
    mFlash.visible = false;
    gunGroup.add(mFlash);
    
    const mLight = new THREE.PointLight('#f59e0b', 0, 15);
    mLight.position.set(0, 0, -1.9);
    gunGroup.add(mLight);

    scene.add(gunGroup);

    // 7. Dynamic Meshes local cache Maps
    const botMeshes = new Map<string, THREE.Group>();       // the Demogorgon
    const remoteMeshes = new Map<string, THREE.Group>();    // online human players
    const projectileMeshes = new Map<string, THREE.Mesh>();
    const pickupMeshes = new Map<string, THREE.Group>();
    
    let lastClientFireTime = 0;
    let recoilProgress = 0;
    let mFTime = 0;
    const projCache = new Map<string, { pos: { x: number; y: number; z: number }; color: string; type: string }>();
    let transientVisuals: { mesh: THREE.Mesh; light?: THREE.PointLight; born: number; duration: number; startScale: number; endScale: number }[] = [];

    // Pre-allocated math and color objects to prevent GC thrashing inside the fast animate loop
    const _camDir = new THREE.Vector3();
    const _rightVec = new THREE.Vector3();
    const _upVec = new THREE.Vector3(0, 1, 0);
    const _gunPos = new THREE.Vector3();
    const _finalGunPos = new THREE.Vector3();
    const _lookTarget = new THREE.Vector3();
    const _targetLook = new THREE.Vector3();

    let lastTime = performance.now();
    let botAnimTime = 0;

    // Continuous Frame Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const stateVal = (gameStateRef && gameStateRef.current) || stateRef.current;
      if (!stateVal) return;

      const now = performance.now();
      const frameDelta = (now - lastTime) / 1000;
      lastTime = now;

      if (!stateVal.isFrozen) {
        botAnimTime += frameDelta;
      }

      try {
        // A. Position camera head-level with the player pos
        const { player } = stateVal;
        camera.position.set(player.pos.x, player.pos.y + 0.55, player.pos.z);

        // A2. Stream the infinite maze in/out around wherever the player currently is
        updateStreamedChunks(player.pos.x, player.pos.z);

        // A3. Pool light under the fluorescent fixtures nearest the player, dark elsewhere
        updateFixtureLights(player.pos.x, player.pos.z);
        
        // Smoothly animate Field of View (Zoom / ADS)
        const targetFOV = player.isAiming ? 32 : 85;
        if (Math.abs(camera.fov - targetFOV) > 0.05) {
          camera.fov += (targetFOV - camera.fov) * 0.22;
          camera.updateProjectionMatrix();
        }
        
        // Euler look angles using pre-allocated _targetLook vector
        _targetLook.set(
          camera.position.x + Math.sin(player.yaw) * Math.cos(player.pitch),
          camera.position.y + Math.sin(player.pitch),
          camera.position.z - Math.cos(player.yaw) * Math.cos(player.pitch)
        );
        camera.lookAt(_targetLook);

        // B. Swing and recoil First-person weapon model
        if (gunGroup) {
          const isCurrentlyAiming = !!player.isAiming;
          
          // Shrink the gun so it occupies less screen space (cleaner visual profile)
          const gunScale = isCurrentlyAiming ? 0.35 : 0.52;
          gunGroup.scale.set(gunScale, gunScale, gunScale);

          // Position weapon cleanly:
          // In ADS, center the gun and slide it down significantly so the red crosshair dot is unobstructed
          const rightOffset = isCurrentlyAiming ? 0.0 : 0.22;
          const downOffset = isCurrentlyAiming ? -0.42 : -0.26;
          const forwardOffset = isCurrentlyAiming ? -0.52 : -0.58;

          camera.getWorldDirection(_camDir);

          _rightVec.crossVectors(_camDir, _upVec).normalize();

          _gunPos.copy(camera.position)
            .addScaledVector(_camDir, forwardOffset)
            .addScaledVector(_rightVec, rightOffset)
            .addScaledVector(_upVec, downOffset);

          _finalGunPos.copy(_gunPos)
            .addScaledVector(_camDir, recoilProgress * -0.16)
            .addScaledVector(_upVec, recoilProgress * 0.04);

          gunGroup.position.copy(_finalGunPos);
          _lookTarget.copy(camera.position).addScaledVector(_camDir, 25);
          gunGroup.lookAt(_lookTarget);
          gunGroup.rotateY(Math.PI);

          // Change neon indicator colors based on what gun is currently equipped
          const weaponNeonMesh = gunGroup.children[2] as THREE.Mesh;
          if (weaponNeonMesh && weaponNeonMesh.material) {
            const weaponColor = player.weapons[player.currentWeapon].color;
            (weaponNeonMesh.material as THREE.MeshBasicMaterial).color.set(weaponColor);
          }
        }

        // C. Render Bots (enemies) and Remote Players (teammates) separately
        const activeEnemyIds = new Set(stateVal.bots.filter(b => !b.isTeammate).map(b => b.id));
        const activeRemoteIds = new Set(stateVal.bots.filter(b => b.isTeammate).map(b => b.id));

        botMeshes.forEach((mesh, id) => {
          if (!activeEnemyIds.has(id)) {
            disposeHierarchy(mesh);
            scene.remove(mesh);
            botMeshes.delete(id);
          }
        });
        remoteMeshes.forEach((mesh, id) => {
          if (!activeRemoteIds.has(id)) {
            disposeHierarchy(mesh);
            scene.remove(mesh);
            remoteMeshes.delete(id);
          }
        });

        // Render remote online players (blue human models, always visible)
        stateVal.bots.filter(b => b.isTeammate).forEach(bot => {
          let remGroup = remoteMeshes.get(bot.id);
          if (!remGroup) {
            remGroup = buildRemotePlayerModel(bot);
            scene.add(remGroup);
            remoteMeshes.set(bot.id, remGroup);
          }
          remGroup.visible = true;
          remGroup.position.set(bot.pos.x, bot.pos.y - 1.0, bot.pos.z);
          const vx = bot.vel.x, vz = bot.vel.z;
          if (vx * vx + vz * vz > 0.05) {
            remGroup.rotation.y = Math.atan2(vx, vz);
          }
        });

        // Render enemy Demogorgons
        stateVal.bots.filter(b => !b.isTeammate).forEach(bot => {
          let botGroup = botMeshes.get(bot.id);
          if (!botGroup) {
            botGroup = buildDemogorgonModel(bot);
            scene.add(botGroup);
            botMeshes.set(bot.id, botGroup);
          }

          // The monster is only rendered while it's actively hunting — otherwise it's lurking, unseen
          botGroup.visible = !bot.isHidden;

          // Rotate bot group to face direction of movement
          const vx = bot.vel.x;
          const vz = bot.vel.z;
          const speedSq = vx * vx + vz * vz;
          if (speedSq > 0.05) {
            const angle = Math.atan2(vx, vz);
            botGroup.rotation.y = angle;
          }

          // Procedural locomotion animations for the eerie Demogorgon
          const isMoving = speedSq > 0.1 && !stateVal.isFrozen;
          const time = botAnimTime * 12;

          // Bob entire bot y-pos slightly in motion or resting breath
          const targetY = bot.pos.y - 1.0 + (isMoving ? Math.abs(Math.sin(time * 2.0)) * 0.04 : Math.sin(time * 0.25) * 0.01);
          botGroup.position.y = targetY;

          // Search named children vectors to apply high-fidelity limb rotations
          botGroup.children.forEach(child => {
            if (child.name === 'head') {
              // Demogorgon head bob and eerie twitching
              const headBase = botGroup.userData.headBaseY || 1.6;
              child.position.y = headBase + (isMoving ? Math.sin(time * 1.5) * 0.02 : Math.sin(time * 0.25) * 0.006);
              child.rotation.z = isMoving ? Math.sin(time * 2.2) * 0.04 : Math.sin(time * 0.4) * 0.015;

              // Animate flower petals opening and closing (gently breathing in its fully bloomed state)
              child.children.forEach(c => {
                if (c.name.startsWith('petal_')) {
                  const baseRot = c.userData.baseRot || [0, 0, 0];
                  // Maintain a fully open bloom, pulsatile organic breathing
                  const pulse = (isMoving ? 0.08 : 0.04) + Math.sin(time * 1.8) * 0.04;
                  
                  if (c.name === 'petal_top') {
                    c.rotation.x = baseRot[0] - pulse;
                  } else if (c.name === 'petal_left') {
                    c.rotation.y = baseRot[1] + pulse;
                  } else if (c.name === 'petal_right') {
                    c.rotation.y = baseRot[1] - pulse;
                  } else if (c.name === 'petal_bot_l') {
                    c.rotation.x = baseRot[0] + pulse;
                    c.rotation.y = baseRot[1] + pulse * 0.5;
                  } else if (c.name === 'petal_bot_r') {
                    c.rotation.x = baseRot[0] + pulse;
                    c.rotation.y = baseRot[1] - pulse * 0.5;
                  }
                }
              });
            } else if (child.name === 'leg_left') {
              // Dragging walk cycle (maintaining splayed leg stance)
              child.rotation.x = isMoving ? Math.sin(time * 1.5) * 0.42 : 0;
              child.rotation.z = (botGroup.userData.legLBaseRotZ ?? -0.32) + (isMoving ? Math.sin(time * 1.5) * 0.06 : 0);
              // Flex Left Knee (calfGroup) organically during gait
              const thighGrp = child.children[1];
              if (thighGrp && thighGrp.children[2]) {
                const calfGrp = thighGrp.children[2];
                calfGrp.rotation.x = -0.75 + (isMoving ? Math.sin(time * 1.5 + Math.PI / 2) * 0.22 : 0);
              }
            } else if (child.name === 'leg_right') {
              // Limping right leg drag cycle (maintaining splayed leg stance)
              child.rotation.x = isMoving ? Math.sin(time * 1.5 - 1.2) * 0.35 + 0.1 : 0.1;
              child.rotation.z = (botGroup.userData.legRBaseRotZ ?? 0.32) + (isMoving ? Math.cos(time * 1.5) * 0.06 : 0);
              // Flex Right Knee organically during gait
              const thighGrp = child.children[1];
              if (thighGrp && thighGrp.children[2]) {
                const calfGrp = thighGrp.children[2];
                calfGrp.rotation.x = -0.75 + (isMoving ? Math.sin(time * 1.5 - 1.2 + Math.PI / 2) * 0.22 : 0);
              }
            } else if (child.name === 'arm_left') {
              // Menacing predator arm sway splayed wide
              const baseRotX = botGroup.userData.armLBaseRotX ?? -Math.PI / 6;
              const baseRotY = botGroup.userData.armLBaseRotY ?? -0.45;
              const baseRotZ = botGroup.userData.armLBaseRotZ ?? -0.75;
              child.rotation.x = baseRotX + Math.sin(time * 1.2) * (isMoving ? 0.12 : 0.04);
              child.rotation.y = baseRotY + Math.cos(time * 0.8) * 0.04;
              child.rotation.z = baseRotZ + Math.sin(time * 0.8) * 0.03;
              // Elastically swing forearm forearmGroup
              const forearmGrp = child.children[2];
              if (forearmGrp) {
                forearmGrp.rotation.x = -1.15 + Math.sin(time * 1.2) * (isMoving ? 0.18 : 0.04);
              }
            } else if (child.name === 'arm_right') {
              const baseRotX = botGroup.userData.armRBaseRotX ?? -Math.PI / 6;
              const baseRotY = botGroup.userData.armRBaseRotY ?? 0.45;
              const baseRotZ = botGroup.userData.armRBaseRotZ ?? 0.75;
              const forearmGrp = child.children[2];

              const meleeDuration = 500;
              const timeSinceMelee = now - bot.lastMeleeTime;
              const isSwiping = timeSinceMelee < meleeDuration;

              if (isSwiping) {
                // Claw swipe: arm raises then slashes forward
                const t = timeSinceMelee / meleeDuration;
                const swing = Math.sin(t * Math.PI); // 0→1→0 arc
                child.rotation.x = baseRotX - 1.8 * swing;
                child.rotation.y = baseRotY - 0.2 * swing;
                child.rotation.z = baseRotZ - 0.5 * swing;
                if (forearmGrp) {
                  forearmGrp.rotation.x = -1.15 + 1.1 * swing;
                }
              } else {
                // Normal idle/walk sway
                child.rotation.x = baseRotX + Math.cos(time * 1.2) * (isMoving ? 0.12 : 0.04);
                child.rotation.y = baseRotY + Math.sin(time * 0.7) * 0.04;
                child.rotation.z = baseRotZ + Math.cos(time * 0.8) * 0.03;
                if (forearmGrp) {
                  forearmGrp.rotation.x = -1.15 + Math.cos(time * 1.2) * (isMoving ? 0.18 : 0.04);
                }
              }
            }
          });

          // Update actual coordinates
          botGroup.position.x = bot.pos.x;
          botGroup.position.z = bot.pos.z;
        });

        // D. Render Projectiles
        const activeProjIds = new Set(stateVal.projectiles.map(p => p.id));
        projectileMeshes.forEach((mesh, id) => {
          if (!activeProjIds.has(id)) {
            disposeHierarchy(mesh);
            scene.remove(mesh);
            projectileMeshes.delete(id);
          }
        });

        stateVal.projectiles.forEach(proj => {
          let mesh = projectileMeshes.get(proj.id);
          if (!mesh) {
            const isRocket = proj.type === 'rocket';
            const isGrenade = proj.type === 'grenade';
            let geo;
            if (isRocket) {
              geo = new THREE.CylinderGeometry(0.15, 0.15, 1.1, 8);
              geo.rotateX(Math.PI / 2);
            } else if (isGrenade) {
              geo = new THREE.DodecahedronGeometry(0.38, 1);
            } else {
              geo = new THREE.SphereGeometry(proj.radius, 8, 8);
            }
            
            const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(proj.color) });
            mesh = new THREE.Mesh(geo, mat);
            scene.add(mesh);
            projectileMeshes.set(proj.id, mesh);
          }
          mesh.position.set(proj.pos.x, proj.pos.y, proj.pos.z);
        });

        // E. Render Pickups
        const timeTick = performance.now() * 0.003;
        const activePickupIds = new Set(stateVal.pickups.map(p => p.id));

        pickupMeshes.forEach((group, id) => {
          if (!activePickupIds.has(id)) {
            disposeHierarchy(group);
            scene.remove(group);
            pickupMeshes.delete(id);
          }
        });

        stateVal.pickups.forEach(pick => {
          let group = pickupMeshes.get(pick.id);
          if (!group) {
            group = new THREE.Group();
            group.position.set(pick.pos.x, pick.pos.y, pick.pos.z);

            const standGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.2, 16);
            const standMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.1 });
            const stand = new THREE.Mesh(standGeo, standMat);
            stand.position.y = -0.55;
            group.add(stand);

            let itemMesh: THREE.Mesh;
            if (pick.type === 'health_mega') {
              const crossBox1 = new THREE.BoxGeometry(0.4, 1.2, 0.4);
              const crossBox2 = new THREE.BoxGeometry(1.2, 0.4, 0.4);
              const materialCross = new THREE.MeshBasicMaterial({ color: '#10b981' });
              itemMesh = new THREE.Mesh(crossBox1, materialCross);
              const bar2 = new THREE.Mesh(crossBox2, materialCross);
              itemMesh.add(bar2);
            } else if (pick.type === 'armor_mega') {
              const octaGeo = new THREE.OctahedronGeometry(0.8);
              const materialOcta = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.05, metalness: 0.9 });
              itemMesh = new THREE.Mesh(octaGeo, materialOcta);
            } else if (pick.type === 'weapon_grenade') {
              const sphereGeo = new THREE.SphereGeometry(0.48, 16, 16);
              const sphereMat = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.1, metalness: 0.8 });
              itemMesh = new THREE.Mesh(sphereGeo, sphereMat);
            } else {
              const boxGeo = new THREE.BoxGeometry(0.6, 0.45, 1.1);
              const boxMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.2 });
              itemMesh = new THREE.Mesh(boxGeo, boxMat);
            }

            group.add(itemMesh);
            scene.add(group);
            pickupMeshes.set(pick.id, group);
          }

          const coreItemMesh = group.children[1] as THREE.Mesh;
          if (coreItemMesh) {
            if (pick.respawnTimer > 0) {
              coreItemMesh.visible = false;
            } else {
              coreItemMesh.visible = true;
              coreItemMesh.position.y = Math.sin(timeTick) * 0.22;
              coreItemMesh.rotation.y = timeTick * 1.5;
            }
          }
        });

        // F. Weapon muzzle flash logic matching current weapons
        const nowTime = performance.now();
        const currWeapon = player.currentWeapon;
        const lastFire = player.weapons[currWeapon].lastFireTime;

        if (lastFire > lastClientFireTime) {
          lastClientFireTime = lastFire;
          recoilProgress = 1.0;
          mFTime = nowTime;

          if (mFlash) {
            mFlash.visible = true;
            mFlash.scale.setScalar(0.7 + Math.random() * 0.7);
            mFlash.rotation.z = Math.random() * Math.PI;
          }
          if (mLight) {
            mLight.intensity = 5.0;
            const col = player.weapons[currWeapon].color;
            mLight.color.set(col);
          }
        }

        if (nowTime - mFTime > 50) {
          if (mFlash) mFlash.visible = false;
          if (mLight) mLight.intensity = 0;
        }

        if (recoilProgress > 0) {
          recoilProgress = Math.max(0, recoilProgress - 0.08);
        }

        // G. Projectile explosions tracking
        const currentProjIds = new Set(stateVal.projectiles.map(p => p.id));
        projCache.forEach((cached, idleId) => {
          if (!currentProjIds.has(idleId)) {
            // Projectile burst fx
            const isRocket = cached.type === 'rocket';
            const isGrenade = cached.type === 'grenade';
            const maxScale = isRocket ? 5.5 : isGrenade ? 6.5 : 2.2;
            const duration = isRocket ? 350 : isGrenade ? 450 : 150;

            const expGeo = new THREE.SphereGeometry(0.5, 12, 12);
            const expMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(cached.color),
              transparent: true,
              opacity: 0.95,
              wireframe: isRocket || isGrenade
            });
            const expMesh = new THREE.Mesh(expGeo, expMat);
            expMesh.position.set(cached.pos.x, cached.pos.y, cached.pos.z);
            scene.add(expMesh);

            let expLight: THREE.PointLight | undefined;
            if (isRocket || isGrenade) {
              expLight = new THREE.PointLight(cached.color, isGrenade ? 20 : 15, isGrenade ? 22 : 18);
              expLight.position.set(cached.pos.x, cached.pos.y, cached.pos.z);
              scene.add(expLight);
            }

            transientVisuals.push({
              mesh: expMesh,
              light: expLight,
              born: nowTime,
              duration: duration,
              startScale: 0.1,
              endScale: maxScale
            });

            projCache.delete(idleId);
          }
        });

        stateVal.projectiles.forEach(p => {
          projCache.set(p.id, {
            pos: { ...p.pos },
            color: p.color,
            type: p.type
          });
        });

        transientVisuals = transientVisuals.filter(fx => {
          const age = nowTime - fx.born;
          if (age >= fx.duration) {
            scene.remove(fx.mesh);
            disposeHierarchy(fx.mesh); // Deep recursive disposal of geometry & materials to prevent WebGL leaks!
            if (fx.light) scene.remove(fx.light);
            return false;
          }

          const ratio = age / fx.duration;
          const scaleVal = fx.startScale + (fx.endScale - fx.startScale) * ratio;
          fx.mesh.scale.setScalar(scaleVal);

          if (fx.mesh.material) {
            (fx.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1.0 - ratio);
          }
          if (fx.light) {
            fx.light.intensity = 15.0 * (1.0 - ratio * ratio);
          }

          return true;
        });

        // J. The one escape wall — a severe, chaotic strobe so it reads as "wrong" the moment
        // someone's flashlight lands on it, but otherwise blends into the maze.
        if (escapeWallMesh) {
          (escapeWallMesh as THREE.Mesh).visible = Math.random() > 0.35;
        }

        // H. Call Render
        renderer.render(scene, camera);

      } catch (err) {
        console.error("Renderer loop crashed: ", err);
      }
    };
    animate();

    // Handle Window Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      // Stop the render loop first regardless of what happens during resource teardown below.
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      try {
        if (mountRef.current && renderer.domElement) {
          if (mountRef.current.contains(renderer.domElement)) {
            mountRef.current.removeChild(renderer.domElement);
          }
        }
        botMeshes.forEach(mesh => {
          disposeHierarchy(mesh);
          scene.remove(mesh);
        });
        botMeshes.clear();

        Array.from(streamedChunkMeshes.keys()).forEach(key => disposeStreamedChunk(key));
        streamedWallMat.dispose();
        streamedCeilingMat.dispose();
        streamedLightMat.dispose();
        streamedFloorMat.dispose();
        puddleMat.dispose();
        wallpaperTexture.dispose();

        renderer.dispose();
      } catch (err) {
        // Never let a WebGL resource-teardown error crash the unmount — worst case is a leaked
        // buffer, not a blank screen for the player.
        console.error('XonoticCanvas teardown error:', err);
      }
    };
  }, []);

  // Handle pointer lock captures to enable standard FPS controls
  const requestLock = () => {
    if (!containerRef.current) return;
    window.focus();
    containerRef.current.focus();
    containerRef.current.requestPointerLock();
  };

  const startManualMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.focus();
    if (containerRef.current) containerRef.current.focus();
    setIsManualActive(true);
    onPointerLockChange(true); // Treat as locked/active for App level playing controls triggers
  };

  useEffect(() => {
    const handleLockState = () => {
      const locked = document.pointerLockElement === containerRef.current;
      setIsLocked(locked);
      if (locked) {
        setIsManualActive(true);
        onPointerLockChange(true);
      } else if (!isManualActive) {
        onPointerLockChange(false);
      }
    };

    const handlePointerLockError = () => {
      console.warn("Pointer lock block/refusal from browser, fallback drag controls available");
    };

    document.addEventListener('pointerlockchange', handleLockState);
    document.addEventListener('pointerlockerror', handlePointerLockError);
    return () => {
      document.removeEventListener('pointerlockchange', handleLockState);
      document.removeEventListener('pointerlockerror', handlePointerLockError);
    };
  }, [onPointerLockChange, isManualActive]);

  // Global mouse listeners for stable pointerlock and dragging controls
  useEffect(() => {
    const handleDocumentMouseMove = (e: MouseEvent) => {
      const sens = 0.0055; // Substantially increased standard pointerlock turning responsiveness

      // 1. If standard pointer lock is active, use movementX/Y
      if (isLocked) {
        onMouseMove(e.movementX * sens, e.movementY * sens);
        return;
      }

      // 2. Fallback Drag mode (when player clicks & drags the screen)
      if (isManualActive && isMouseDownRef.current) {
        const dx = e.clientX - lastMousePosRef.current.x;
        const dy = e.clientY - lastMousePosRef.current.y;
        
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        
        // Significantly increased fallback drag sensitivity for snappy lookaround
        onMouseMove(dx * 0.006, dy * 0.006);
      }
    };

    const handleDocumentMouseDown = (e: MouseEvent) => {
      // Check if clicking the canvas area
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        isMouseDownRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      }
    };

    const handleDocumentMouseUp = () => {
      isMouseDownRef.current = false;
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [isLocked, isManualActive, onMouseMove]);

  // Automatically focus on mount to allow immediate keyboard controls
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  const handleContainerClick = () => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
    if (!isLocked) {
      requestLock();
    }
  };

  const isActive = isLocked || isManualActive;

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      tabIndex={0}
      className="w-full h-screen relative cursor-crosshair select-none overflow-hidden outline-none focus:outline-none"
    >
      {/* Three.js Canvas mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* The Red Room curse: permanent red peripheral vignette — once this is on, it never turns off */}
      {!!state.inRedRoom && (
        <div className="absolute inset-0 pointer-events-none z-30 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(153,0,0,0.55)_100%)] animate-pulse" />
      )}

      {/* Scope Zoom Background Mask Layer */}
      {isActive && !!state.player.isAiming && (
        <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center animate-fade-in">
          {/* Outermost pitch-black vignette border */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_650px_at_center,transparent_20%,rgba(0,0,0,0.92)_100%)]" targetid="vignette" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_380px_at_center,transparent_85%,rgba(0,0,0,0.98)_100%)]" />
          
          {/* Glass Circular Scope border outline */}
          <div className="w-[380px] h-[380px] rounded-full border-[3px] border-cyan-500/60 shadow-[0_0_35px_rgba(6,182,212,0.35),_inset_0_0_40px_rgba(6,182,212,0.18)] bg-cyan-950/[0.04] relative flex items-center justify-center">
            {/* Scope Compass Headings */}
            <span className="absolute top-4 text-[9px] font-mono text-cyan-400/90 font-bold tracking-widest uppercase animate-pulse">
              ADS LOCK-ON PRECISION
            </span>
            <span className="absolute bottom-4 text-[8px] font-mono text-slate-400/80 uppercase">
              RECOIL SENSITIVITY DECAYED
            </span>
          </div>
        </div>
      )}

      {/* Crosshair drawn perfectly in dead center */}
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-45">
          {state.player.isAiming ? (
            <div className="relative flex items-center justify-center">
              {/* Specialized Sniper Zoom Reticle */}
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full border border-black shadow-[0_0_8px_rgba(239,68,68,0.9)] z-50"></div>
              {/* Extended Crosshair lines */}
              <div className="absolute h-[1.5px] w-52 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
              <div className="absolute w-[1.5px] h-52 bg-gradient-to-b from-transparent via-cyan-400 to-transparent"></div>
              {/* Rings */}
              <div className="absolute w-24 h-24 rounded-full border border-cyan-500/40 border-dashed"></div>
              <div className="absolute w-40 h-40 rounded-full border border-cyan-500/20"></div>
              {/* Horizontal / Vertical Tick marks */}
              <div className="absolute h-8 w-[1px] bg-cyan-400/80 -translate-x-[36px]"></div>
              <div className="absolute h-8 w-[1px] bg-cyan-400/80 translate-x-[36px]"></div>
              <div className="absolute w-8 h-[1px] bg-cyan-400/80 -translate-y-[36px]"></div>
              <div className="absolute w-8 h-[1px] bg-cyan-400/80 translate-y-[36px]"></div>
              <span className="absolute text-[8px] font-mono text-cyan-400/85 -translate-x-[44px] -translate-y-2">15m</span>
              <span className="absolute text-[8px] font-mono text-cyan-400/85 translate-x-[44px] -translate-y-2">15m</span>
            </div>
          ) : (
            <div className="relative">
              {/* Standard Quake-style Crosshair */}
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full border border-black/50 shadow-md"></div>
              {/* Outer crosshairs */}
              <div className="absolute w-4 h-[2px] bg-emerald-400 left-[-12px] top-[2px] border-l border-t border-b border-black/30"></div>
              <div className="absolute w-4 h-[2px] bg-emerald-400 right-[-12px] top-[2px] border-r border-t border-b border-black/30"></div>
              <div className="absolute w-[2px] h-4 bg-emerald-400 top-[-12px] left-[2px] border-t border-l border-r border-black/30"></div>
              <div className="absolute w-[2px] h-4 bg-emerald-400 bottom-[-12px] left-[2px] border-b border-l border-r border-black/30"></div>
            </div>
          )}
        </div>
      )}

      {/* Manual controller indicator in manual drag drag mode */}
      {isManualActive && !isLocked && (
        <div className="absolute top-20 right-6 z-48 bg-slate-900/60 backdrop-blur border border-cyan-500/20 text-cyan-400 px-3 py-1.5 rounded-lg text-xs font-mono font-medium tracking-tight animate-pulse pointer-events-none">
          Drag on screen to look around (마우스 드래그로 조준 가능)
        </div>
      )}

      {/* Trigger Lock reminder overlay */}
      {!isActive && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-center px-4 transition-all animate-fade-in">
          <div className="max-w-md p-8 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.15)]">
            <h2 className="text-3xl font-sans tracking-tight text-white mb-2 uppercase select-none">
              BACk ROOM
            </h2>
            <p className="text-sm font-sans text-slate-400 mb-6 font-medium leading-relaxed">
              격렬한 3D 아레나 FPS 게임에 참여하세요. 화면을 클릭하거나 아래 버튼으로 게임을 직접 시작하세요!
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={requestLock}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl shadow-lg border border-cyan-400/20 active:scale-95 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                LOCK MOUSE & PLAY (기본 마우스 고정 모드)
              </button>
              <button
                onClick={startManualMode}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl shadow-md border border-cyan-400/10 active:scale-95 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                MANUAL PLAY (드래그 조준 모드 - iframe/모바일 추천)
              </button>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 text-left text-xs text-slate-400 border-t border-slate-800 pt-6">
              <div>
                <span className="font-mono text-cyan-400 block mb-1">MOVEMENTS</span>
                W, A, S, D<br />
                SPACE (BUNNY JUMP)
              </div>
              <div>
                <span className="font-mono text-purple-400 block mb-1">WEAPONS CONTROL</span>
                LEFT CLICK (SHOOT)<br />
                1, 2, 3, 4 (CHANGE GUNS)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Prevent React re-renders on the WebGL canvas on standard position/velocity ticks,
  // but allow updates when pointerlock hooks re-bind, when the player aims in/out (to render the
  // zoom screen layer), or when the permanent Red Room curse takes hold (red vignette overlay).
  return prevProps.onPointerLockChange === nextProps.onPointerLockChange &&
         prevProps.onMouseMove === nextProps.onMouseMove &&
         prevProps.state.player.isAiming === nextProps.state.player.isAiming &&
         prevProps.state.inRedRoom === nextProps.state.inRedRoom;
});
