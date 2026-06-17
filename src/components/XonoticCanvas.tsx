/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { XonoticGameState, Bot, Projectile, PickupItem, PeacefulNpc } from '../game/xonoticTypes';
import { getXonoticMap } from '../game/xonoticMap';

// Helper to build procedural low-poly peaceful village human NPCs
function buildHumanModel(npc: PeacefulNpc): THREE.Group {
  const group = new THREE.Group();
  
  // Base materials helper
  const createNpcMat = (colorStr: string, roughness = 0.5, metalness = 0.0) => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorStr),
      roughness: roughness,
      metalness: metalness
    });
  };

  const skinColors = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
  const skinColorsIndex = npc.id.charCodeAt(npc.id.length - 1) || 0;
  const skinColor = skinColors[skinColorsIndex % skinColors.length];

  const skinMat = createNpcMat(skinColor);
  const clothMat = createNpcMat(npc.clothesColor);
  const pantsMat = createNpcMat('#1e293b'); // dark pants
  const bootMat = createNpcMat('#451a03'); // brown boots

  // 1. Torso
  const torsoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.25);
  const torso = new THREE.Mesh(torsoGeo, clothMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // 2. Head
  const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);

  // Hair / accessories based on gender/role
  const hairColor = npc.gender === 'elder' ? '#cbd5e1' : '#1e1b4b'; // grey hair for elders, dark for others
  const hairMat = createNpcMat(hairColor);
  
  // Hair cap
  const hairGeo = new THREE.BoxGeometry(0.34, 0.12, 0.34);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 0.12, -0.01);
  head.add(hair);

  if (npc.gender === 'woman') {
    // Ponytail / long hair backing
    const ponytailGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
    const ponytail = new THREE.Mesh(ponytailGeo, hairMat);
    ponytail.position.set(0, -0.08, -0.17);
    head.add(ponytail);
  } else if (npc.name.includes('여행자') || npc.gender === 'child') {
    // Cute cap
    const capGeo = new THREE.BoxGeometry(0.34, 0.08, 0.34);
    const cap = new THREE.Mesh(capGeo, createNpcMat('#10b981')); // emerald cap
    cap.position.set(0, 0.15, 0.02);
    head.add(cap);
    
    // Visor
    const visorGeo = new THREE.BoxGeometry(0.34, 0.02, 0.12);
    const visor = new THREE.Mesh(visorGeo, createNpcMat('#10b981'));
    visor.position.set(0, 0.12, 0.2);
    head.add(visor);
  }

  // Head face features (Eyes)
  const eyeMat = createNpcMat('#1e293b');
  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), eyeMat);
  leftEye.position.set(-0.08, 0.04, 0.161);
  head.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), eyeMat);
  rightEye.position.set(0.08, 0.04, 0.161);
  head.add(rightEye);

  // 3. Legs
  const legLGroup = new THREE.Group();
  legLGroup.name = 'legL';
  legLGroup.position.set(-0.16, 0.72, 0);
  const legLGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
  legLGeo.translate(0, -0.275, 0); // origin at top hip pivot
  const legL = new THREE.Mesh(legLGeo, pantsMat);
  legL.castShadow = true;
  legLGroup.add(legL);

  // left boot
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.24), bootMat);
  bootL.position.set(0, -0.55, 0.03);
  bootL.castShadow = true;
  legLGroup.add(bootL);
  group.add(legLGroup);

  const legRGroup = new THREE.Group();
  legRGroup.name = 'legR';
  legRGroup.position.set(0.16, 0.72, 0);
  const legRGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
  legRGeo.translate(0, -0.275, 0);
  const legR = new THREE.Mesh(legRGeo, pantsMat);
  legR.castShadow = true;
  legRGroup.add(legR);

  // right boot
  const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.24), bootMat);
  bootR.position.set(0, -0.55, 0.03);
  bootR.castShadow = true;
  legRGroup.add(bootR);
  group.add(legRGroup);

  // 4. Arms
  const armLGroup = new THREE.Group();
  armLGroup.name = 'armL';
  armLGroup.position.set(-0.35, 1.35, 0);
  const armLGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  armLGeo.translate(0, -0.3, 0); // origin at shoulder pivot
  const armL = new THREE.Mesh(armLGeo, clothMat);
  armL.castShadow = true;
  armLGroup.add(armL);

  const handL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skinMat);
  handL.position.set(0, -0.62, 0);
  handL.castShadow = true;
  armLGroup.add(handL);
  group.add(armLGroup);

  const armRGroup = new THREE.Group();
  armRGroup.name = 'armR';
  armRGroup.position.set(0.35, 1.35, 0);
  const armRGeo = new THREE.BoxGeometry(0.14, 0.6, 0.14);
  armRGeo.translate(0, -0.3, 0);
  const armR = new THREE.Mesh(armRGeo, clothMat);
  armR.castShadow = true;
  armRGroup.add(armR);

  const handR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skinMat);
  handR.position.set(0, -0.62, 0);
  handR.castShadow = true;
  armRGroup.add(handR);
  group.add(armRGroup);

  // ── Name label sprite (always faces camera) ──
  const nc = document.createElement('canvas');
  nc.width = 256; nc.height = 60;
  const ctx = nc.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 60);
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.beginPath();
  if ((ctx as any).roundRect) (ctx as any).roundRect(4, 4, 248, 52, 10);
  else ctx.rect(4, 4, 248, 52);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fffbe6';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(npc.name, 128, 32);
  const labelTex = new THREE.CanvasTexture(nc);
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, depthTest: false, transparent: true }));
  labelSprite.scale.set(1.9, 0.45, 1);
  labelSprite.position.set(0, 2.18, 0);
  group.add(labelSprite);

  return group;
}

// Helper to build procedural low-poly Demogorgon models from Stranger Things
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

  // Demogorgon fleshy color variations (pale, muddy, slightly pinkish grey)
  const fleshColors = [
    '#91847c', // Wet slimy grey clay
    '#a28d80', // Fleshy pale rose grey
    '#7a6c62', // Dried soil mud flesh
    '#b09f94', // Ghastly pale skin
  ];
  const demoSkinColor = fleshColors[index % fleshColors.length];
  
  // Glistening skin: lower roughness, higher metalness/specular look
  const skinMat = createMat(demoSkinColor, 0.45, 0.22); 

  const rawBloodMat = createMat('#610204', 0.28, 0.05);  // Wet, rich inner tissue red
  const petalInnerMat = createMat('#940b0f', 0.35, 0.05); // Bloody pinkish petal interior
  const toxicSlimeMat = createMat('#15a34a', 0.2, 0.4);   // Glowing green spores
  const boneMat = createMat('#f1f5f9', 0.8, 0.0);         // Skeletal ivory white
  const clawMat = createMat('#0b0f19', 0.3, 0.7);         // Obsidian black claws
  
  // Glistening dynamic saliva/slime material
  const salivaMat = new THREE.MeshStandardMaterial({
    color: '#cdf0ce',
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
  const armL = isStrong ? 2.15 : 1.75;  // extremely long, scary limbs
  
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

  const basePosY = isStrong ? 2.10 : 1.65; // raised hips to fit lanky legs standing cleanly on the floor
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
    const yellowBoneMat = createMat('#eab308', 0.65);
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
  const legH = isStrong ? 2.45 : 2.00;  // extremely long intimidating legs (increased slightly as requested)

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

  // All demogorgons same height ~2.1 units (human 1.78 + 1 head ~0.32)
  // Boss model has larger proportions (legH/bodyH bigger), so needs smaller scale to match same height
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

    const activeLightnings: THREE.Group[] = [];

    // Precalculated high-performance Trigonometric Lookup Tables (LUTs) 
    // to completely bypass expensive Math.sin / Math.cos calls inside the particle loop.
    const SIN_LUT_SIZE = 1024;
    const SIN_LUT = new Float32Array(SIN_LUT_SIZE);
    const COS_LUT = new Float32Array(SIN_LUT_SIZE);
    for (let i = 0; i < SIN_LUT_SIZE; i++) {
      const angle = (i / SIN_LUT_SIZE) * Math.PI * 2;
      SIN_LUT[i] = Math.sin(angle);
      COS_LUT[i] = Math.cos(angle);
    }

    // Static, pre-allocated shared geometry and materials for all 3D red lightning bolts.
    // Minimizes memory creation and garbage collection pressure to maintain a solid 60+ FPS.
    const unitCylinderGeo = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 4);
    const boltMat = new THREE.MeshBasicMaterial({ color: '#f43f5e' }); // Intense glowing neon red
    const branchMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });

    // Helper to generate an authentic, jagged, branching 3D red lightning bolt that stays high in the sky
    const createLightningBolt = (startX: number, startZ: number, endX: number, endZ: number): THREE.Group => {
      const group = new THREE.Group();
      const segments = 9;
      const startY = 48; // Spawn very high up in the sky
      const endY = 28;   // End high up, never hitting the ground
      
      const points: THREE.Vector3[] = [];
      points.push(new THREE.Vector3(startX, startY, startZ));
      
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const px = startX + (endX - startX) * t + (Math.random() - 0.5) * 8.0;
        const pz = startZ + (endZ - startZ) * t + (Math.random() - 0.5) * 8.0;
        const py = startY + (endY - startY) * t + (Math.random() - 0.5) * 2.0;
        points.push(new THREE.Vector3(px, py, pz));
      }
      points.push(new THREE.Vector3(endX, endY, endZ));

      // Connected thick tubes for glorious and stark 3D lightning meshes!
      for (let i = 0; i < points.length - 1; i++) {
        const pA = points[i];
        const pB = points[i + 1];
        
        const distance = pA.distanceTo(pB);
        const segment = new THREE.Mesh(unitCylinderGeo, boltMat);
        segment.scale.set(0.24, distance, 0.24);
        
        const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
        segment.position.copy(mid);
        
        const direction = new THREE.Vector3().subVectors(pB, pA).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
        segment.setRotationFromQuaternion(quaternion);
        
        group.add(segment);
      }

      // Add a couple of branching forks (also confined to high altitude)
      for (let f = 2; f < points.length - 2; f += 2) {
        if (Math.random() < 0.70) {
          const branchStart = points[f];
          const branchEnd = new THREE.Vector3(
            branchStart.x + (Math.random() - 0.5) * 12,
            Math.max(24, branchStart.y - 8), // Keep branches well above the ground level
            branchStart.z + (Math.random() - 0.5) * 12
          );

          const branchPoints = [branchStart];
          branchPoints.push(new THREE.Vector3(
            branchStart.x + (branchEnd.x - branchStart.x) * 0.5 + (Math.random() - 0.5) * 4,
            branchStart.y - (branchStart.y - branchEnd.y) * 0.5 + (Math.random() - 0.5) * 1.5,
            branchStart.z + (branchEnd.z - branchStart.z) * 0.5 + (Math.random() - 0.5) * 4
          ));
          branchPoints.push(branchEnd);

          for (let k = 0; k < branchPoints.length - 1; k++) {
            const pA = branchPoints[k];
            const pB = branchPoints[k + 1];
            const dist = pA.distanceTo(pB);
            const segment = new THREE.Mesh(unitCylinderGeo, branchMat);
            segment.scale.set(0.12, dist, 0.12);
            const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
            segment.position.copy(mid);
            const dir = new THREE.Vector3().subVectors(pB, pA).normalize();
            segment.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
            group.add(segment);
          }
        }
      }

      return group;
    };

    // 1. Create Scene & The Upside Down dark background with subtle atmospheric fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101222'); // Made background brighter for crisp visual target visibility
    scene.fog = new THREE.FogExp2('#0f111e', 0.002); // Thin brightened ash fog for maximum tactical clarity
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

    // 4. Lighting Rig (Elevated cold atmospheric illumination for maximum gameplay visibility)
    const ambientLight = new THREE.AmbientLight('#444a73', 5.8); // Higher neutral ambient light (returned to beautiful 5.8)
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#7482be', 8.2); // Directional sunlight (returned to beautiful 8.2)
    dirLight.position.set(30, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024; // Balanced quality/performance shadow resolution
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -90; // Expanded to match 160x160 arena
    dirLight.shadow.camera.right = 90;
    dirLight.shadow.camera.top = 90;
    dirLight.shadow.camera.bottom = -90;
    dirLight.shadow.bias = -0.0005; // Eliminates shadow acne artifacts
    scene.add(dirLight);

    const accentColors = ['#dc2626', '#cd153f', '#7c3aed']; // Ominous red, dark raspberry crimson, deep purple
    for (let i = 0; i < 3; i++) {
      const pointLight = new THREE.PointLight(accentColors[i], 18, 55);
      pointLight.position.set((i - 1) * 20, 10, (i - 1) * -15);
      scene.add(pointLight);
    }

    const floorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a1926'),
      roughness: 0.90,
      metalness: 0.01,
    });

    // 5. Build static map geometry styled elegantly as the decayed Upside Down landscape with high visibility!
    const map = getXonoticMap();
    map.walls.forEach(wall => {
      if (wall.collisionOnly) return; // Invisible collision-only walls (buildings use their own Canvas meshes)
      const geometry = new THREE.BoxGeometry(wall.size.x, wall.size.y, wall.size.z);
      
      let material: THREE.Material;
      if (wall.id === 'floor_main') {
        material = floorMat;
      } else if (wall.id.startsWith('bridge') || wall.id.startsWith('center_spire')) {
        // Visible dark maroon wooden/organic planks covered in spores
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#42222a'), // lighter greyish-maroon flesh-like wood tones
          roughness: 0.85,
          metalness: 0.05,
        });
      } else if (wall.id.startsWith('wall_')) {
        // Ash-stained metallic grey obsidian stone walls
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#323247'),
          roughness: 0.75,
          metalness: 0.15,
        });
      } else if (wall.emissive) {
        // Bioluminescent red fleshy egg sacs / alien growths
        material = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ea580c') }); 
      } else {
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(wall.color).multiplyScalar(0.7), // Richer colors for visual separation
          roughness: 0.8,
          metalness: 0.1,
        });
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(wall.pos.x, wall.pos.y, wall.pos.z);
      mesh.receiveShadow = !wall.emissive;
      mesh.castShadow = !wall.emissive;
      scene.add(mesh);
    });

    // Subtle veins of the Upside Down grid (bioluminescent dark violet/red roots)
    const gridHelper = new THREE.GridHelper(160, 160, '#581c87', '#120c1a');
    gridHelper.position.y = 0.05;
    scene.add(gridHelper);

    // --- FLOATING ASH / SPORES (The Upside Down Particle System with increased count) ---
    const particleCount = 750; // Raised dust density for drift richness
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 160;
      particlePositions[i * 3 + 1] = Math.random() * 25;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      color: '#cbd5e1', // ash and dust floating particles
      size: 0.16,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const ashParticles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(ashParticles);

    // ── Dummy refs kept for animate-loop material switches ──
    const trunkMat  = new THREE.MeshStandardMaterial({ color: '#16141a', roughness: 0.95 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.8 });
    foliageMat.visible = false;
    const vineMat   = new THREE.MeshStandardMaterial({ color: '#101d42', roughness: 0.9 });

    // ═══════════════════════════════════════════════════
    //   HAWKINS, INDIANA — 1980s American Rural Town
    // ═══════════════════════════════════════════════════

    // Shared materials
    const mCream  = new THREE.MeshStandardMaterial({ color: '#ddd5b8', roughness: 0.85 });
    const mBrick  = new THREE.MeshStandardMaterial({ color: '#9b4a35', roughness: 0.9 });
    const mBlue   = new THREE.MeshStandardMaterial({ color: '#4a6fa5', roughness: 0.8 });
    const mYellow = new THREE.MeshStandardMaterial({ color: '#c8a03a', roughness: 0.8 });
    const mRoofDk = new THREE.MeshStandardMaterial({ color: '#3a3a2a', roughness: 0.9 });
    const mRoofBr = new THREE.MeshStandardMaterial({ color: '#5c4a30', roughness: 0.9 });
    const mWoodT  = new THREE.MeshStandardMaterial({ color: '#7a5c3a', roughness: 0.95 });
    const mDoor   = new THREE.MeshStandardMaterial({ color: '#4a2c1a', roughness: 0.85 });
    const mWin    = new THREE.MeshStandardMaterial({ color: '#9bc4e8', roughness: 0.1, metalness: 0.3, emissive: new THREE.Color('#3a72a8'), emissiveIntensity: 0.2 });
    const mConc   = new THREE.MeshStandardMaterial({ color: '#a09080', roughness: 0.7 });
    const mRoad   = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.75 });
    const mMkY    = new THREE.MeshStandardMaterial({ color: '#e8c040', roughness: 0.3, emissive: new THREE.Color('#b08020'), emissiveIntensity: 0.25 });
    const mMkW    = new THREE.MeshStandardMaterial({ color: '#f0f0e0', roughness: 0.3, emissive: new THREE.Color('#c0c0b0'), emissiveIntensity: 0.12 });
    const mPoleW  = new THREE.MeshStandardMaterial({ color: '#5c4828', roughness: 0.9 });
    const mWireT  = new THREE.MeshStandardMaterial({ color: '#202020', roughness: 0.8 });
    const mWhiteP = new THREE.MeshStandardMaterial({ color: '#f0ece0', roughness: 0.7 });
    const mSignR  = new THREE.MeshStandardMaterial({ color: '#cc2020', roughness: 0.3, emissive: new THREE.Color('#880808'), emissiveIntensity: 0.35 });
    const mSignW  = new THREE.MeshStandardMaterial({ color: '#fffff0', roughness: 0.3, emissive: new THREE.Color('#fffff0'), emissiveIntensity: 0.3 });
    const mGrav   = new THREE.MeshStandardMaterial({ color: '#6a6058', roughness: 0.9 });
    const mCarG   = new THREE.MeshStandardMaterial({ color: '#2d5a3a', roughness: 0.35, metalness: 0.5 });
    const mCarB   = new THREE.MeshStandardMaterial({ color: '#253d6a', roughness: 0.35, metalness: 0.5 });
    const mCarBe  = new THREE.MeshStandardMaterial({ color: '#c8a855', roughness: 0.4, metalness: 0.4 });
    const mCarGl  = new THREE.MeshStandardMaterial({ color: '#88aacc', roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.65 });
    const mCarTi  = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.95 });
    // Extra materials for building details
    const mStone  = new THREE.MeshStandardMaterial({ color: '#888070', roughness: 0.85 }); // stone/mortar
    const mAwnR   = new THREE.MeshStandardMaterial({ color: '#b82020', roughness: 0.7 });  // red awning
    const mAwnW   = new THREE.MeshStandardMaterial({ color: '#f0ede0', roughness: 0.7 });  // white awning stripe
    const mFlagR  = new THREE.MeshStandardMaterial({ color: '#cc1020', roughness: 0.5, emissive: new THREE.Color('#660810'), emissiveIntensity: 0.2 });
    const mFlagW  = new THREE.MeshStandardMaterial({ color: '#f0f0e8', roughness: 0.5 });
    const mFlagB  = new THREE.MeshStandardMaterial({ color: '#1a2a6a', roughness: 0.5 });
    const mNeon   = new THREE.MeshStandardMaterial({ color: '#ffb020', roughness: 0.2, emissive: new THREE.Color('#cc8010'), emissiveIntensity: 0.8 }); // neon marquee
    const mTheater = new THREE.MeshStandardMaterial({ color: '#2a1a0a', roughness: 0.8 }); // theater facade
    const mFence  = new THREE.MeshStandardMaterial({ color: '#e8e4d8', roughness: 0.8 }); // white picket fence

    // Box helper
    const addB = (w: number, h: number, d: number, px: number, py: number, pz: number,
                  mat: THREE.MeshStandardMaterial, parent: THREE.Object3D = scene, shad = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(px, py, pz);
      if (shad) { m.castShadow = true; m.receiveShadow = true; }
      parent.add(m);
      return m;
    };

    // ── ROADS ──
    // Main Street (E-W, z=22) — full 160-unit width
    addB(158, 0.12, 7,  0, 0.06, 22, mRoad, scene, false);
    addB(158, 0.06, 1.5, 0, 0.03, 18.25, mConc, scene, false); // N shoulder
    addB(158, 0.06, 1.5, 0, 0.03, 25.75, mConc, scene, false); // S shoulder
    for (let rx = -77; rx < 77; rx += 5.5)
      addB(3, 0.02, 0.2, rx, 0.14, 22, mMkY, scene, false);    // yellow center dashes
    for (let rx = -77; rx < 77; rx += 4) {
      addB(2.5, 0.02, 0.15, rx, 0.13, 18.6, mMkW, scene, false);
      addB(2.5, 0.02, 0.15, rx, 0.13, 25.4, mMkW, scene, false);
    }
    // N-S connector (lab south gate → Main St.)
    addB(5, 0.12, 7, 0, 0.06, 25.5, mRoad, scene, false);
    // N-S side road (z: -78 → -25, connecting north areas)
    addB(5, 0.12, 53, 0, 0.06, -51.5, mRoad, scene, false);
    for (let rz = -77; rz < -25; rz += 5.5)
      addB(0.2, 0.02, 3, 0, 0.14, rz, mMkY, scene, false);
    // Maple Ave (E-W residential, z=55) — main residential street
    addB(120, 0.12, 6, 0, 0.06, 55, mRoad, scene, false);
    addB(120, 0.06, 1.4, 0, 0.03, 51.3, mConc, scene, false); // N shoulder
    addB(120, 0.06, 1.4, 0, 0.03, 58.7, mConc, scene, false); // S shoulder
    for (let rx = -59; rx < 59; rx += 5.5)
      addB(3, 0.02, 0.2, rx, 0.14, 55, mMkY, scene, false);
    // N-S west connector: x=-32, Main St (z=22) → Maple Ave (z=55)
    addB(5, 0.12, 36, -32, 0.06, 38.5, mRoad, scene, false);
    // N-S east connector: x=32
    addB(5, 0.12, 36,  32, 0.06, 38.5, mRoad, scene, false);
    // N-S west connector 남쪽 연장: Maple Ave (z=55) → 주거지 (z=78)
    addB(5, 0.12, 23, -32, 0.06, 66.5, mRoad, scene, false);
    // N-S east connector 남쪽 연장: Maple Ave (z=55) → 주거지 (z=78)
    addB(5, 0.12, 23,  32, 0.06, 66.5, mRoad, scene, false);
    // 북쪽 도로 → Main Street 연결: 연구소 서쪽 우회
    // E-W 교차로 (z=-25): 북쪽 도로(x=0) → 우회도로(x=-20)
    addB(22, 0.12, 5, -10, 0.06, -25, mRoad, scene, false);
    // N-S 우회도로 (x=-20): z=-25 → Main Street (z=19)
    addB(5, 0.12, 44, -20, 0.06, -3, mRoad, scene, false);

    // ── UTILITY POLES helper ──
    const buildPoles = (
      positions: number[], axis: 'x' | 'z',
      fixedA: number,
      poleH = 10, armLen = 3.8
    ) => {
      positions.forEach((p, pi) => {
        const px = axis === 'x' ? p : fixedA;
        const pz = axis === 'z' ? p : fixedA;
        addB(0.26, poleH, 0.26, px, poleH / 2, pz, mPoleW);
        // crossarm
        if (axis === 'x') addB(armLen, 0.18, 0.18, px, poleH - 0.8, pz, mPoleW);
        else              addB(0.18, 0.18, armLen, px, poleH - 0.8, pz, mPoleW);
        // insulators
        [-armLen / 2.8, armLen / 2.8].forEach(off => {
          const ix = axis === 'x' ? px + off : px;
          const iz = axis === 'z' ? pz + off : pz;
          addB(0.18, 0.28, 0.18, ix, poleH - 1.0, iz, mWhiteP);
        });
        // wire to next pole
        if (pi < positions.length - 1) {
          const np = positions[pi + 1];
          const npx = axis === 'x' ? np : fixedA;
          const npz = axis === 'z' ? np : fixedA;
          const len = Math.abs(np - p);
          const mx = (px + npx) / 2;
          const mz = (pz + npz) / 2;
          if (axis === 'x') addB(len, 0.04, 0.04, mx, poleH - 1.2, mz, mWireT, scene, false);
          else              addB(0.04, 0.04, len, mx, poleH - 1.2, mz, mWireT, scene, false);
          // second wire (lower)
          if (axis === 'x') addB(len, 0.04, 0.04, mx, poleH - 1.8, mz, mWireT, scene, false);
          else              addB(0.04, 0.04, len, mx, poleH - 1.8, mz, mWireT, scene, false);
        }
      });
    };

    // Main Street — south shoulder (z=26.5)
    buildPoles([-72,-60,-48,-36,-24,-12,0,12,24,36,48,60,72], 'x', 26.5, 11, 4.5);
    // Maple Ave — south shoulder (z=60)
    buildPoles([-54,-42,-30,-18,-6,6,18,30,42,54], 'x', 60, 9, 3.5);
    // N-S main road — east shoulder (x=3.5)
    buildPoles([-72,-64,-56,-48,-40,-32], 'z', 3.5, 9, 3.2);
    // N-S west connector — west shoulder (x=-37)
    buildPoles([26,34,42,50], 'z', -37, 8, 3.0);
    // N-S east connector — east shoulder (x=37)
    buildPoles([26,34,42,50], 'z', 37, 8, 3.0);

    // ── PARKED CARS ──
    const buildCar = (px: number, pz: number, ry: number, bMat: THREE.MeshStandardMaterial) => {
      const g = new THREE.Group();
      g.position.set(px, 0, pz);
      g.rotation.y = ry;
      addB(4.5, 1.3, 2,  0, 0.85, 0, bMat, g);
      addB(2.8, 0.85, 1.7, -0.2, 1.95, 0, bMat, g);
      addB(0.12, 0.75, 1.5,  1.15, 1.88, 0, mCarGl, g, false);
      addB(0.12, 0.65, 1.5, -1.55, 1.85, 0, mCarGl, g, false);
      [[-1.5,-1.05],[-1.5,1.05],[1.2,-1.05],[1.2,1.05]].forEach(([wx,wz]) =>
        addB(0.6, 0.6, 0.38, wx, 0.3, wz, mCarTi, g));
      scene.add(g);
    };
    buildCar(-22, 18.3, 0,       mCarG);
    buildCar( 14, 26,   Math.PI, mCarB);
    buildCar( -8, 26,   Math.PI, mCarBe);
    buildCar( 42, -18,  0,       mCarBe); // at gas station

    // ── GABLED ROOF HELPER (ExtrudeGeometry triangle, rotated to sit on walls) ──
    const makeGabledRoof = (bW: number, bD: number, wallTopY: number, roofH: number,
                            mat: THREE.MeshStandardMaterial): THREE.Mesh => {
      const dOver = bD / 2 + 0.55;
      const L = bW + 1.1;
      const profile = new THREE.Shape();
      profile.moveTo(-dOver, 0);
      profile.lineTo(0, roofH);
      profile.lineTo(dOver, 0);
      profile.closePath();
      const geo = new THREE.ExtrudeGeometry(profile, { depth: L, bevelEnabled: false });
      geo.rotateY(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.position.set(-L / 2, wallTopY, 0);
      return mesh;
    };

    // ── 80s AMERICAN RANCH HOUSE BUILDER ──
    const buildRanch = (px: number, pz: number, ry: number,
                        wMat: THREE.MeshStandardMaterial, rMat: THREE.MeshStandardMaterial) => {
      const g = new THREE.Group();
      g.position.set(px, 0, pz);
      g.rotation.y = ry;
      const bW = 11, bH = 3.8, bD = 8, foundH = 0.45;
      const wallTop = bH + foundH;
      // Foundation slab
      addB(bW + 0.6, foundH + 0.1, bD + 0.6, 0, (foundH + 0.1) / 2, 0, mConc, g);
      // Main walls
      addB(bW, bH, bD, 0, bH / 2 + foundH, 0, wMat, g);
      // Gabled roof
      g.add(makeGabledRoof(bW, bD, wallTop, 2.6, rMat));
      // Chimney
      addB(0.9, 3.2, 0.9, 3.6, wallTop + 1.2, 0.6, mBrick, g);
      // Porch deck & step
      addB(5.2, 0.2, 2.5,  0, foundH + 0.1,  bD / 2 + 1.25, mConc, g);
      addB(5.5, 0.1, 0.15, 0, foundH + 0.2,  bD / 2 + 2.55, mConc, g);
      // Porch columns
      [-2.1, 2.1].forEach(ox =>
        addB(0.22, 2.5, 0.22, ox, foundH + 1.25, bD / 2 + 2.45, mWoodT, g));
      // Porch railings
      addB(4.6, 0.12, 0.1, 0, foundH + 2.55, bD / 2 + 2.45, mWoodT, g);
      addB(4.6, 0.10, 0.1, 0, foundH + 0.75, bD / 2 + 2.45, mWoodT, g);
      // Porch roof overhang
      addB(5.6, 0.18, 2.8, 0, wallTop - 0.5, bD / 2 + 1.4, rMat, g);
      // Front door + wood frame
      addB(1.15, 2.5,  0.2,  0, foundH + 1.25,  bD / 2 + 0.01, mDoor, g);
      addB(1.55, 2.85, 0.14, 0, foundH + 1.425, bD / 2 + 0.04, mWoodT, g);
      // Front windows with frames & shutters
      [-3.3, 3.3].forEach(ox => {
        addB(1.6,  1.3,  0.18, ox, foundH + 2.3,  bD / 2 + 0.01, mWin, g);
        addB(2.05, 1.65, 0.12, ox, foundH + 2.3,  bD / 2 + 0.04, mWoodT, g);
        [-1.12, 1.12].forEach(sx =>
          addB(0.38, 1.3, 0.1, ox + sx, foundH + 2.3, bD / 2 + 0.09, mRoofDk, g));
      });
      // Side windows
      addB(0.14, 1.2, 1.5,  bW / 2 + 0.01, foundH + 2.2, 0, mWin, g);
      addB(0.14, 1.2, 1.5, -bW / 2 - 0.01, foundH + 2.2, 0, mWin, g);
      // Concrete driveway
      addB(3.5, 0.08, bD + 4, bW / 2 + 1.75, 0.04, -2.0, mConc, g);
      // Mailbox post + box
      addB(0.12, 1.2, 0.12, bW / 2 + 6.5, 0.6, bD / 2 + 2.0, mWoodT, g);
      addB(0.6,  0.4,  0.9, bW / 2 + 6.5, 1.3, bD / 2 + 2.0, mSignR, g);
      // White picket fence (front yard, flanking porch)
      const fenceZ = bD / 2 + 3.4;
      const fenceW = 8;
      addB(fenceW, 0.12, 0.1, -bW / 2 - 1.2, 1.2, fenceZ, mFence, g); // left top rail
      addB(fenceW, 0.12, 0.1, -bW / 2 - 1.2, 0.6, fenceZ, mFence, g); // left bot rail
      for (let pi = 0; pi < 8; pi++)
        addB(0.1, 1.1, 0.1, -bW / 2 - 1.2 - fenceW / 2 + pi * 1.15, 0.55, fenceZ, mFence, g);
      addB(fenceW, 0.12, 0.1,  bW / 2 + 1.2, 1.2, fenceZ, mFence, g); // right top rail
      addB(fenceW, 0.12, 0.1,  bW / 2 + 1.2, 0.6, fenceZ, mFence, g);
      for (let pi = 0; pi < 8; pi++)
        addB(0.1, 1.1, 0.1, bW / 2 + 1.2 - fenceW / 2 + pi * 1.15, 0.55, fenceZ, mFence, g);
      scene.add(g);
    };

    // ── HAWKINS VILLAGE LAYOUT — buildings spread across the map ──
    // Maple Ave north side row (z=66, all facing south toward road)
    buildRanch(-44, 66, Math.PI,        mCream,  mRoofDk); // Wheeler house
    buildRanch( 40, 66, Math.PI,        mBlue,   mRoofDk); // Hargrove house
    // Back street row (z=76, facing south)
    buildRanch(-52, 76, Math.PI,        mYellow, mRoofBr); // Byers house
    buildRanch( 44, 76, Math.PI,        mCream,  mRoofBr); // Kellerman house
    // Rural outskirts
    buildRanch( 65, -62, 0.3,           mYellow, mRoofBr); // Abandoned farmhouse
    buildRanch(-62, -44, Math.PI * 0.8, mCream,  mRoofDk); // Outer ranch

    // ── MELVALD'S GENERAL STORE (x=20, z=36) ──
    {
      const g = new THREE.Group();
      g.position.set(20, 0, 36);
      addB(14, 5, 10,  0, 2.5, 0,      mBrick, g);
      addB(15, 1, 11,  0, 5.5, 0,      mBrick, g);    // parapet
      // Sign board
      addB(12, 1.5, 0.4, 0, 5.0, 5.2,  mSignR, g);
      addB(10, 0.8, 0.1,  0, 5.0, 5.42, mSignW, g);
      // Striped awning (alternating red/white panels)
      [-4.5,-1.5,1.5,4.5].forEach((ox, i) =>
        addB(2.8, 0.25, 2.2, ox, 4.05, 6.1, i % 2 === 0 ? mAwnR : mAwnW, g));
      addB(14, 0.22, 0.3, 0, 4.05, 7.25, mAwnR, g); // awning valance
      // Front windows (3) with wood frames
      [-4, 0, 4].forEach(ox => {
        addB(2.5, 2, 0.2, ox, 2.0, 5.1, mWin, g);
        addB(0.15, 2.1, 0.12, ox - 1.35, 2.0, 5.14, mWoodT, g); // left jamb
        addB(0.15, 2.1, 0.12, ox + 1.35, 2.0, 5.14, mWoodT, g); // right jamb
      });
      addB(1.4, 2.8, 0.2, 0, 1.4, 5.1, mDoor, g);
      // Sidewalk + step + barrel + crates
      addB(18, 0.12, 3.5, 0, 0.06, 7.5, mConc, g);
      addB(14, 0.1, 0.12, 0, 0.1, 9.3, mConc, g);   // curb
      addB(0.9, 1.3, 0.9, 5.5, 0.65, 7.0, mWoodT, g); // barrel
      addB(0.7, 0.12, 0.7, 5.5, 1.36, 7.0, mConc, g);  // barrel lid
      addB(1.2, 0.8, 0.9, -5.2, 0.4, 7.2, mWoodT, g);  // crate A
      addB(1.0, 0.8, 1.0, -5.3, 1.2, 7.2, mWoodT, g);  // crate B stacked
      scene.add(g);
    }

    // ── HAWKINS GAS STATION (x=42, z=-15) ──
    {
      const g = new THREE.Group();
      g.position.set(42, 0, -15);
      addB(7, 4, 6,   0, 2, 0,   mWhiteP, g);
      addB(8, 0.6, 7, 0, 4.3, 0, mRoofDk, g);
      addB(18, 0.5, 10, 0, 4.5, 0, mConc, g);
      [-7, 7].forEach(ox => addB(0.35, 4.5, 0.35, ox, 2.25, 0, mConc, g));
      [-3, 3].forEach(ox => {
        addB(0.9, 2.2, 0.55, ox, 1.1, 4.5, mSignR, g);
        addB(0.6, 0.5, 0.1,  ox, 1.6, 4.84, mSignW, g);
      });
      addB(0.2, 9, 0.2,   -8, 4.5, 0,    mPoleW, g);
      addB(3.5, 2.5, 0.4, -8, 9.5, 0,    mSignR, g);
      addB(3, 1.8, 0.1,   -8, 9.5, 0.26, mSignW, g);
      addB(1.2, 2.5, 0.2,  2, 1.25, 3.1, mDoor, g);
      addB(1.5, 1.5, 0.2, -1.5, 2.0, 3.1, mWin, g);
      addB(20, 0.1, 12, 0, 0.05, 0, mGrav, g, false);
      scene.add(g);
    }

    // ── FIRST COMMUNITY CHURCH (x=-42, z=-18) ──
    {
      const g = new THREE.Group();
      g.position.set(-42, 0, -18);
      const naveW = 10, naveH = 5.5, naveD = 9;
      addB(naveW, naveH, naveD, 0, naveH / 2, 0, mWhiteP, g);
      g.add(makeGabledRoof(naveW, naveD, naveH, 2.8, mRoofDk));
      addB(3.5, 8, 3.5, 0, 4,    -3.5, mWhiteP, g);
      addB(2.5, 0.8, 2.5, 0, 8.4, -3.5, mRoofDk, g);
      addB(1.5, 1.5, 1.5, 0, 9.55,-3.5, mRoofDk, g);
      addB(0.5, 2, 0.5,   0, 11.3,-3.5, mRoofDk, g);
      addB(0.2, 1.5, 0.2, 0, 13.1,-3.5, mSignW, g);
      addB(1.2, 0.2, 0.2, 0, 13.2,-3.5, mSignW, g);
      [-2.8, 2.8].forEach(ox => addB(1.2, 2, 0.2, ox, 3.0, naveD / 2 + 0.1, mWin, g));
      addB(1.4, 3, 0.2, 0, 1.5, naveD / 2 + 0.1, mDoor, g);
      addB(4, 0.35, 1.5, 0, 0.175, naveD / 2 + 1, mConc, g);
      scene.add(g);
    }

    // ── HAWKINS MIDDLE SCHOOL (x=-35, z=-52) ──
    {
      const g = new THREE.Group();
      g.position.set(-35, 0, -52);
      // Main building + east wing
      addB(22, 6, 12, 0, 3, 0, mBrick, g);
      addB(23, 0.7, 13, 0, 6.35, 0, mRoofDk, g);
      addB(10, 5, 8, 16, 2.5, -2, mBrick, g);   // east wing
      addB(11, 0.6, 9, 16, 5.3, -2, mRoofDk, g);
      // Windows (main facade)
      [-8,-4,0,4,8].forEach(ox =>
        [1.5, 4].forEach(oy => addB(1.6, 1.4, 0.18, ox, oy, 6.1, mWin, g)));
      // East wing windows
      [13,17,21].forEach(ox =>
        [1.5, 3.5].forEach(oy => addB(1.4, 1.2, 0.18, ox, oy, 2.1, mWin, g)));
      // Main entrance
      [-0.7, 0.7].forEach(ox => addB(0.9, 2.6, 0.2, ox, 1.3, 6.1, mDoor, g));
      addB(5, 0.4, 2,  0, 3.5, 7.2, mConc, g);
      [-2, 2].forEach(ox => addB(0.3, 3.5, 0.3, ox, 1.75, 7.2, mConc, g));
      // Sign
      addB(10, 1.5, 0.4, 0, 5.5, 6.2, mSignR, g);
      addB(9, 1.0, 0.1,  0, 5.5, 6.42, mSignW, g);
      // Flag pole + flag
      addB(0.15, 13, 0.15, -14, 6.5, 5, mPoleW, g);
      addB(3.0, 0.6, 0.06, -12.5, 12.4, 5, mFlagR, g);
      addB(3.0, 0.6, 0.06, -12.5, 11.8, 5, mFlagW, g);
      addB(3.0, 0.6, 0.06, -12.5, 11.2, 5, mFlagR, g);
      addB(1.2, 1.8, 0.07, -13.1, 11.8, 5, mFlagB, g);
      // Basketball hoop (pole + backboard + rim)
      addB(0.2, 5.5, 0.2, -18, 2.75, -8, mConc, g);   // pole
      addB(1.8, 1.2, 0.1, -17.4, 5.8, -8, mWhiteP, g); // backboard
      addB(1.2, 0.12, 1.2, -17.4, 5.1, -8, mSignR, g, false); // rim (square approx)
      // Parking lot + chain-link fence posts
      addB(22, 0.1, 10, 0, 0.05, -9.5, mGrav, g, false);
      for (let fx = -11; fx <= 11; fx += 3.5)
        addB(0.12, 2.0, 0.12, fx, 1.0, -15, mConc, g);
      addB(23, 0.1, 0.1, 0, 2.1, -15, mWireT, g, false); // top wire
      addB(23, 0.1, 0.1, 0, 1.35, -15, mWireT, g, false);
      scene.add(g);
    }

    // ── HAWKINS POLICE DEPARTMENT (x=-15, z=36) ──
    {
      const g = new THREE.Group();
      g.position.set(-15, 0, 36);
      addB(12, 4.5, 9, 0, 2.25, 0, mBrick, g);
      addB(13, 0.7, 10, 0, 4.85, 0, mRoofDk, g);
      // Steps + entrance canopy
      addB(6, 0.2, 2.0, 0, 0.1, 5.5, mConc, g);
      addB(6, 0.15, 0.1, 0, 0.3, 6.55, mConc, g);   // step edge
      addB(7, 0.18, 2.2, 0, 3.5, 5.6, mConc, g);    // entry canopy
      [-2.8, 2.8].forEach(ox => addB(0.25, 3.5, 0.25, ox, 1.75, 5.6, mConc, g)); // canopy posts
      // Sign
      addB(10, 1.5, 0.4, 0, 4.2, 4.7, mSignR, g);
      addB(9,  0.8, 0.1,  0, 4.2, 4.95, mSignW, g);
      // Barred windows (windows + bars)
      [-3.5, 3.5].forEach(ox => {
        addB(1.5, 1.4, 0.2, ox, 2.2, 4.6, mWin, g);
        [-0.45, 0, 0.45].forEach(bx => addB(0.08, 1.4, 0.12, ox + bx, 2.2, 4.65, mConc, g));
      });
      addB(1.2, 2.6, 0.2, 0, 1.3, 4.6, mDoor, g);
      // American flag pole + flag panels
      addB(0.15, 11, 0.15, 8, 5.5, 3.5, mPoleW, g);
      addB(3.5, 0.7, 0.06, 9.75, 10.5, 3.5, mFlagR, g);
      addB(3.5, 0.7, 0.06, 9.75, 9.8, 3.5, mFlagW, g);
      addB(3.5, 0.7, 0.06, 9.75, 9.1, 3.5, mFlagR, g);
      addB(1.4, 2.1, 0.07, 8.7, 9.8, 3.5, mFlagB, g);  // blue canton
      // Parking lot
      addB(14, 0.1, 9, 0, 0.05, -8, mGrav, g, false);
      [-4.5, 0, 4.5].forEach(lx => addB(0.12, 0.05, 8, lx + 2.25, 0.12, -8, mMkW, g, false));
      scene.add(g);
    }

    // ── HAWKINS PUBLIC LIBRARY — with CLOCK TOWER (x=55, z=-32) ──
    // The visual heart of downtown Hawkins (inspired by Butts County Probate Court)
    {
      const g = new THREE.Group();
      g.position.set(55, 0, -32);
      // Main building body (neoclassical / brick civic)
      addB(16, 5.5, 12, 0, 2.75, 0, mBrick, g);
      addB(17, 0.8, 13, 0, 5.9, 0, mConc, g);     // cornice
      // Front portico with columns
      addB(12, 6.5, 3.5, 0, 3.25, 7.75, mStone, g);   // portico base
      [-4, -1.3, 1.3, 4].forEach(cx =>
        addB(0.55, 6.5, 0.55, cx, 3.25, 9, mStone, g)); // 4 columns
      addB(12.5, 0.5, 4, 0, 6.75, 7.75, mStone, g);   // entablature
      // Front door (double)
      [-0.55, 0.55].forEach(dx => addB(0.7, 2.8, 0.2, dx, 1.4, 7.0, mDoor, g));
      // Fanlight above door
      addB(1.8, 0.6, 0.2, 0, 3.15, 7.0, mWin, g);
      // Arched windows on facade
      [-5.5, 0, 5.5].forEach(ox => {
        addB(2.2, 2.5, 0.2, ox, 3.5, 6.1, mWin, g);
        addB(2.5, 0.3, 0.14, ox, 4.9, 6.14, mConc, g); // arch cap
      });
      // Broad entrance steps
      [0, 1, 2].forEach(step =>
        addB(14 - step * 0.8, 0.22, 1.2, 0, step * 0.22, 7.65 + step * 1.2 + 0.6, mConc, g));
      // ── CLOCK TOWER (Hawkins landmark) ──
      addB(4.5, 10, 4.5, 0, 8, -0.5, mStone, g);      // tower shaft
      addB(5.0, 0.5, 5.0, 0, 13.25, -0.5, mConc, g);  // clock band
      // Clock faces (4 sides)
      [[0, 0, 5.5 / 2 + 0.26], [0, 0, -(5.5 / 2 + 0.26)],
       [5.5 / 2 + 0.26, 0, 0], [-(5.5 / 2 + 0.26), 0, 0]].forEach(([cx, cy, cz]) =>
        addB(Math.abs(cz) > 0.5 ? 3.5 : 0.2, 3.5, Math.abs(cz) > 0.5 ? 0.2 : 3.5,
             cx, 13.25, cz, mWin, g));
      addB(5.2, 0.5, 5.2, 0, 15.25, -0.5, mConc, g); // belfry cornice
      addB(3.2, 4.5, 3.2, 0, 17.75, -0.5, mRoofDk, g); // pyramid spire base
      addB(0.5, 2.5, 0.5, 0, 20.75, -0.5, mRoofDk, g); // spire tip
      addB(0.15, 1.5, 0.15, 0, 22.5, -0.5, mPoleW, g); // flagpole on tower
      // Side wings
      [-8, 8].forEach(wx => {
        addB(4, 4, 10, wx, 2, 0, mBrick, g);           // wing
        addB(4.5, 0.6, 10.5, wx, 4.3, 0, mConc, g);   // wing cornice
        addB(2.5, 2, 0.2, wx, 2.2, 5.1, mWin, g);     // wing window
      });
      // Library sign on portico
      addB(9, 1.0, 0.15, 0, 5.6, 9.55, mSignW, g);
      // Sidewalk / plaza
      addB(22, 0.1, 8, 0, 0.05, 12, mConc, g, false);
      scene.add(g);
    }

    // ── HAWK THEATER (x=20, z=8) — between lab and Main St, iconic 80s cinema ──
    {
      const g = new THREE.Group();
      g.position.set(20, 0, 8);
      // Facade body
      addB(14, 7, 8, 0, 3.5, 0, mTheater, g);
      addB(15, 0.8, 9, 0, 7.4, 0, mTheater, g);     // parapet
      // Vertical marquee tower center
      addB(4, 11, 1.0, 0, 5.5, 4.6, mTheater, g);   // marquee structure
      addB(3.6, 10, 0.2, 0, 5.5, 5.15, mNeon, g);   // neon front face
      // MARQUEE box jutting out
      addB(8, 3.5, 3, 0, 3.8, 6.0, mTheater, g);    // marquee box
      addB(8.5, 0.2, 3.2, 0, 5.55, 6.0, mNeon, g);  // neon top
      addB(8.5, 0.2, 3.2, 0, 2.05, 6.0, mNeon, g);  // neon bottom
      [-3.8, 3.8].forEach(ox => addB(0.2, 3.5, 3.2, ox, 3.8, 6.0, mNeon, g)); // sides
      // Ticket booth protrusion
      addB(3, 3.5, 2.5, 0, 1.75, 5.75, mConc, g);
      addB(1.0, 2.2, 0.2, 0, 1.1, 7.0, mWin, g);   // ticket window
      // Windows (upper, flanking marquee)
      [-5, 5].forEach(ox => addB(2.2, 2.2, 0.2, ox, 4.5, 4.1, mWin, g));
      // Doors (double)
      [-1.2, 1.2].forEach(dx => addB(0.9, 2.5, 0.2, dx, 1.25, 4.1, mDoor, g));
      // Sidewalk
      addB(18, 0.1, 4, 0, 0.05, 6.5, mConc, g, false);
      scene.add(g);
    }

    // --- THE GATE / DIMENSIONAL PORTAL (Behind Spawn point on North Wall) ---
    const portalGroup = new THREE.Group();
    portalGroup.position.set(-28, 15.5, -34.5); // perfect eye height directly on the roof platform (spawn at -28, 14.5, -28)
    portalGroup.scale.set(0.55, 1.7, 1.0); // Pre-scaled into a vertical human / demon eye shape!

    // Outer meaty-flesh border with named material
    const portalOuterMat = new THREE.MeshStandardMaterial({ color: '#160408', roughness: 0.95 });
    const portalOuterRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.3, 0.42, 8, 32),
      portalOuterMat
    );
    portalGroup.add(portalOuterRing);

    // Inner glowing red/orange ring with named material
    const portalInnerMat = new THREE.MeshStandardMaterial({ color: '#45060d', roughness: 0.95 });
    const portalInnerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.28, 8, 32),
      portalInnerMat
    );
    portalGroup.add(portalInnerRing);

    // Center tear core mesh flat facing South direction with named material
    const portalCoreGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.15, 32);
    portalCoreGeo.rotateX(Math.PI / 2);
    const portalCoreMat = new THREE.MeshBasicMaterial({ color: '#e11d48' }); // intense rose-red glowing slit
    const portalCoreMesh = new THREE.Mesh(
      portalCoreGeo,
      portalCoreMat
    );
    portalGroup.add(portalCoreMesh);

    // Dynamic central core center slit with named material
    const portalCoreSlitGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.17, 32);
    portalCoreSlitGeo.rotateX(Math.PI / 2);
    const portalCoreSlitMat = new THREE.MeshBasicMaterial({ color: '#ea580c' }); // hot pulsing orange gate center
    const portalCoreSlitMesh = new THREE.Mesh(
      portalCoreSlitGeo,
      portalCoreSlitMat
    );
    portalGroup.add(portalCoreSlitMesh);

    // Human/feline creepiness: central vertical dark slit pupil centered perfectly in the eye rifts!
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#000000' });
    const pupilGeo = new THREE.BoxGeometry(0.42, 2.0, 0.22);
    const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
    pupilMesh.position.set(0, 0, 0.15); // right over center glows
    portalGroup.add(pupilMesh);

    // Direct warm Gate PointLight reflecting glowing red atmosphere onto player spawn platform
    const portalPointLight = new THREE.PointLight('#f43f5e', 14.0, 24);
    portalPointLight.position.set(0, 0, 1.2);
    portalGroup.add(portalPointLight);

    scene.add(portalGroup);


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
    const botMeshes = new Map<string, THREE.Group>();       // enemy Demogorgons
    const remoteMeshes = new Map<string, THREE.Group>();    // online human players
    const npcMeshes = new Map<string, THREE.Group>();
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
    const _colorBg1 = new THREE.Color('#101222');
    const _colorBg2 = new THREE.Color('#500305');
    const _colorFog1 = new THREE.Color('#0f111e');
    const _colorFog2 = new THREE.Color('#320204');
    const _colorDir1 = new THREE.Color('#7482be');
    const _colorDir2 = new THREE.Color('#f43f5e');

    let lastTime = performance.now();
    let botAnimTime = 0;

    // Continuous Frame Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const stateVal = (gameStateRef && gameStateRef.current) || stateRef.current;
      if (!stateVal) return;

      const isPeaceful = stateVal.dimension === 'peaceful';

      // Dynamically override material characteristics based on dimension (Overworld vs Upside Down)
      if (isPeaceful) {
        // Green lush ivy vines
        vineMat.color.set('#22c55e');
        vineMat.roughness = 0.8;
        // Warm brown healthy wood trees
        trunkMat.color.set('#78350f');
        // No foliage in Hawkins (replaced by buildings)
        foliageMat.visible = false;
        // Dry Indiana grass ground
        floorMat.color.set('#6b7c45');
        // NO floating dust/spores in the peaceful world!
        ashParticles.visible = false;
        // Bright golden dandelion spores
        particleMaterial.color.set('#fef08a');
        particleMaterial.size = 0.22;
        // Dimensional portal color must look EXACTLY the same as in the upside-down world (ominous red blood/orange eye shape)
        portalOuterMat.color.set('#160408');
        portalInnerMat.color.set('#45060d');
        portalCoreMat.color.set('#e11d48');
        portalCoreSlitMat.color.set('#ea580c');
        if (portalPointLight) {
          portalPointLight.color.set('#f43f5e');
        }
      } else {
        // Dark creepy organic violet-blue vines
        vineMat.color.set('#101d42');
        vineMat.roughness = 0.9;
        // Burnt charcoal black wood trees
        trunkMat.color.set('#16141a');
        // Foliage is barren in the Upside Down
        foliageMat.visible = false;
        // Decayed dark violet-black earth ground
        floorMat.color.set('#1a1926');
        // Show ash/dust spores in the scary Upside Down
        ashParticles.visible = true;
        // Dull ash gray falling spores
        particleMaterial.color.set('#cbd5e1');
        particleMaterial.size = 0.16;
        // Ominous blood red/orange gate rings
        portalOuterMat.color.set('#160408');
        portalInnerMat.color.set('#45060d');
        portalCoreMat.color.set('#e11d48');
        portalCoreSlitMat.color.set('#ea580c');
        if (portalPointLight) {
          portalPointLight.color.set('#f43f5e');
        }
      }

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

          // Toggle Demogorgon visibility based on active dimension (hidden in Peaceful world)
          botGroup.visible = !isPeaceful;

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

        // C2. Render Peaceful NPCs (Civilian villagers who do NOT follow the player)
        const activeNpcIds = new Set((stateVal.npcs || []).map(n => n.id));

        npcMeshes.forEach((mesh, id) => {
          if (!activeNpcIds.has(id)) {
            disposeHierarchy(mesh);
            scene.remove(mesh);
            npcMeshes.delete(id);
          }
        });

        if (stateVal.npcs) {
          stateVal.npcs.forEach(npc => {
            let npcGroup = npcMeshes.get(npc.id);
            if (!npcGroup) {
              npcGroup = buildHumanModel(npc);
              scene.add(npcGroup);
              npcMeshes.set(npc.id, npcGroup);
            }

            // Visible only in the peaceful world!
            npcGroup.visible = isPeaceful;

            // Face direction of movement
            const vx = npc.vel.x;
            const vz = npc.vel.z;
            const speedSq = vx * vx + vz * vz;
            if (speedSq > 0.02) {
              const angle = Math.atan2(vx, vz);
              npcGroup.rotation.y = angle;
            }

            // Walk animation
            const isMoving = speedSq > 0.05 && !stateVal.isFrozen;
            const time = botAnimTime * 8; // gentle speed factor

            // Bob slightly
            npcGroup.position.x = npc.pos.x;
            npcGroup.position.z = npc.pos.z;
            npcGroup.position.y = npc.pos.y - 1.0 + (isMoving ? Math.abs(Math.sin(time * 1.5)) * 0.03 : Math.sin(time * 0.15) * 0.005);

            // Arm / Leg swing animations
            npcGroup.children.forEach(child => {
              if (child.name === 'legL') {
                child.rotation.x = isMoving ? Math.sin(time) * 0.45 : 0;
              } else if (child.name === 'legR') {
                child.rotation.x = isMoving ? -Math.sin(time) * 0.45 : 0;
              } else if (child.name === 'armL') {
                child.rotation.x = isMoving ? -Math.sin(time) * 0.4 : 0.08 * Math.sin(time * 0.2);
              } else if (child.name === 'armR') {
                child.rotation.x = isMoving ? Math.sin(time) * 0.4 : -0.08 * Math.sin(time * 0.2);
              }
            });
          });
        }

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

        // I. Drifting Ash/Spores in the Upside Down style weightless dust - optimized update loop with high-speed LUT lookups
        if (ashParticles && ashParticles.visible) {
          const posAttr = ashParticles.geometry.attributes.position as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;
          const count = posAttr.count;
          const timeTick = now * 0.00025;
          for (let i = 0; i < count; i++) {
            const idx = i * 3;
            // High-speed index mappings using bitwise fast truncation & power-of-two modulo (& 1023)
            const angleIdx1 = ((timeTick * 250 + i) | 0) & 1023;
            const angleIdx2 = ((timeTick * 100 + i * 50) | 0) & 1023;
            const angleIdx3 = ((timeTick * 82 + i * 50) | 0) & 1023;

            // Access directly using fast look-up table without heavy math calls
            arr[idx + 1] += SIN_LUT[angleIdx1] * 0.016 - 0.009;
            arr[idx] += SIN_LUT[angleIdx2] * 0.016;
            arr[idx + 2] += COS_LUT[angleIdx3] * 0.016;

            if (arr[idx + 1] < 0) {
              arr[idx + 1] = 25;
              arr[idx] = (Math.random() - 0.5) * 80;
              arr[idx + 2] = (Math.random() - 0.5) * 80;
            } else if (arr[idx + 1] > 25) {
              arr[idx + 1] = 0;
            }
          }
          posAttr.needsUpdate = true;
        }

        // J. Dimensional Portal Breathing & Pulsating Aura Animation
        if (portalGroup && portalPointLight) {
          const portalCycle = now * 0.0032;
          const pulseFactor = 1.0 + Math.sin(portalCycle) * 0.05;
          portalGroup.scale.set(0.55 * pulseFactor, 1.7 * pulseFactor, 1.0); // Retains beautiful vertical eye aspect ratio
          portalPointLight.intensity = 14.0 + Math.sin(now * 0.008) * 4.0;
        }

        // K. Atmosphere rendering: Lightning in Upside Down, Serene Sunshine in Peaceful Overworld
        if (isPeaceful) {
          // Beautiful Overworld sunshine day! No random scary lightning storms!
          (scene.background as THREE.Color).set('#bae6fd'); // bright blue sky
          if (scene.fog) {
            (scene.fog as THREE.FogExp2).color.set('#e0f2fe'); // lovely warm sky fog
          }
          dirLight.color.set('#fda4af'); // beautiful golden sunset sun illumination
          dirLight.intensity = 11.5;     // bright warm sunlight
          ambientLight.color.set('#fef08a'); // sun rays ambient
          ambientLight.intensity = 9.8;

          // Make sure lightning is removed when transitioning to peaceful overworld
          if (activeLightnings.length > 0) {
            activeLightnings.forEach(bolt => {
              scene.remove(bolt);
            });
            activeLightnings.length = 0;
          }
        } else {
          // Standard Upside Down mode with occasional red lightning storm strikes
          ambientLight.color.set('#444a73'); // Restore default ambient light color for Upside Down!
          
          const lightningPeriod = 7000;
          const lightningLen = 500; // Duration of flash is half a second
          const timeOffset = now % lightningPeriod;

          if (timeOffset < lightningLen) {
            const ratio = timeOffset / lightningLen;
            let strobeIntensity = 0;
            
            // Double rapid lightning fire pattern (Initial blast, minor dim, second massive roar)
            if (ratio < 0.18) {
              strobeIntensity = ratio / 0.18;
            } else if (ratio < 0.35) {
              strobeIntensity = 1.0 - (ratio - 0.18) / 0.17 * 0.5;
            } else if (ratio < 0.60) {
              strobeIntensity = ((ratio - 0.35) / 0.25) * 0.8 + 0.5;
            } else {
              strobeIntensity = 1.0 - (ratio - 0.60) / 0.40;
            }

            // Spawn genuine 3D branching red lightning bolt meshes on strike commencement!
            if (activeLightnings.length === 0) {
              const px1 = (Math.random() - 0.5) * 56;
              const pz1 = (Math.random() - 0.5) * 56;
              const px2 = (Math.random() - 0.5) * 56;
              const pz2 = (Math.random() - 0.5) * 56;

              const bolt1 = createLightningBolt(px1 + (Math.random() - 0.5) * 14, pz1 + (Math.random() - 0.5) * 14, px1, pz1);
              const bolt2 = createLightningBolt(px2 + (Math.random() - 0.5) * 14, pz2 + (Math.random() - 0.5) * 14, px2, pz2);

              scene.add(bolt1);
              scene.add(bolt2);
              activeLightnings.push(bolt1, bolt2);
            }

            // Rapidly flicker lightning visibility for visual impact
            activeLightnings.forEach(b => {
              b.visible = Math.random() > 0.16;
            });

            // Transform scene background & fog into a horrific storm blood red - using pre-allocated Colors
            (scene.background as THREE.Color).lerpColors(_colorBg1, _colorBg2, strobeIntensity);
            if (scene.fog) {
              (scene.fog as THREE.FogExp2).color.lerpColors(_colorFog1, _colorFog2, strobeIntensity);
            }
            dirLight.color.lerpColors(_colorDir1, _colorDir2, strobeIntensity);
            dirLight.intensity = 8.2 + strobeIntensity * 18.0; // Returned to baseline intensity (8.2 baseline)
            ambientLight.intensity = 5.8 + strobeIntensity * 4.5; // Returned to baseline intensity (5.8 baseline)
          } else {
            // Clean up lightning meshes after standard lightning duration
            if (activeLightnings.length > 0) {
              activeLightnings.forEach(bolt => {
                scene.remove(bolt);
              });
              activeLightnings.length = 0;
            }

            // Standard slightly brightened dark violet atmosphere for high-visibility gameplay (Returned to baseline brightness as requested)
            (scene.background as THREE.Color).set('#101222');
            if (scene.fog) {
              (scene.fog as THREE.FogExp2).color.set('#0f111e');
            }
            dirLight.color.set('#7482be');
            dirLight.intensity = 8.2; // Beautiful baseline visibility
            ambientLight.intensity = 5.8; // Beautiful baseline visibility
          }
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
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        if (mountRef.current.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
      activeLightnings.forEach(bolt => {
        scene.remove(bolt);
      });
      activeLightnings.length = 0;

      // Dispose of the pre-allocated shared lightning static assets
      unitCylinderGeo.dispose();
      boltMat.dispose();
      branchMat.dispose();
      botMeshes.forEach(mesh => {
        disposeHierarchy(mesh);
        scene.remove(mesh);
      });
      botMeshes.clear();

      npcMeshes.forEach(mesh => {
        disposeHierarchy(mesh);
        scene.remove(mesh);
      });
      npcMeshes.clear();

      particleGeometry.dispose();
      particleMaterial.dispose();

      // Dispose of shared tree and vine geometries to prevent resource leakage on unmount
      trunkGeo.dispose();
      branchGeo1.dispose();
      branchGeo2.dispose();
      leafGeoTop.dispose();
      leafGeoBranch.dispose();
      trunkMat.dispose();
      foliageMat.dispose();

      vineGeoVertical.dispose();
      vineGeoHorizX.dispose();
      vineGeoHorizZ.dispose();
      vineGeoClimb.dispose();
      vineMat.dispose();

      renderer.dispose();
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
              Xonotic Web Arena
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
  // but allow updates when pointerlock hooks re-bind, when the world dimension shifts,
  // or when the player aims in/out (to render the zoom screen layer).
  return prevProps.onPointerLockChange === nextProps.onPointerLockChange &&
         prevProps.onMouseMove === nextProps.onMouseMove &&
         prevProps.state.player.isAiming === nextProps.state.player.isAiming &&
         prevProps.state.dimension === nextProps.state.dimension;
});
