import React, { useState, useEffect, useRef } from 'react';
import './FitnessTracker.css';

const FitnessTracker = () => {
  // State variables
  const [isTracking, setIsTracking] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState('DEEP_SQUAT');
  const [repetitionCount, setRepetitionCount] = useState(0);
  const [movementPhase, setMovementPhase] = useState('ready');
  const [feedback, setFeedback] = useState('AI Fitness Coach ready! Select an exercise and click "Start Training" to begin.');
  const [showPoseData, setShowPoseData] = useState(false);
  const [highlightedPoint, setHighlightedPoint] = useState(null);
  const [currentPose, setCurrentPose] = useState(null);
  const [exerciseStats, setExerciseStats] = useState({
    squats: 0,
    pushups: 0,
    jumpingJacks: 0,
    toeTouches: 0,
    curls: 0
  });
  
  // Exercise tracking variables
  const [isInPosition, setIsInPosition] = useState(false);
  const [lastRepTime, setLastRepTime] = useState(0);
  
  // Refs
  const videoElement = useRef(null);
  const overlayCanvas = useRef(null);
  const canvasCtx = useRef(null);
  const pose = useRef(null);
  const camera = useRef(null);

  // Constants
  const bodyPoints = {
    NOSE: 0,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
  };

  const pointNames = [
    'NOSE', 'LEFT_EYE_INNER', 'LEFT_EYE', 'LEFT_EYE_OUTER', 'RIGHT_EYE_INNER',
    'RIGHT_EYE', 'RIGHT_EYE_OUTER', 'LEFT_EAR', 'RIGHT_EAR', 'MOUTH_LEFT',
    'MOUTH_RIGHT', 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW',
    'LEFT_WRIST', 'RIGHT_WRIST', 'LEFT_PINKY', 'RIGHT_PINKY', 'LEFT_INDEX',
    'RIGHT_INDEX', 'LEFT_THUMB', 'RIGHT_THUMB', 'LEFT_HIP', 'RIGHT_HIP',
    'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE', 'LEFT_HEEL',
    'RIGHT_HEEL', 'LEFT_FOOT_INDEX', 'RIGHT_FOOT_INDEX'
  ];

  const POSE_CONNECTIONS = [
    [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
    [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23],
    [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29],
    [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]
  ];

  // Exercise stages
  const exerciseStages = {
    DEEP_SQUAT: { lastPos: 'up', cooldown: false },
    CHEST_PRESS: { lastPos: 'up', cooldown: false },
    AB_CURL: { lastPos: 'up', cooldown: false },
    STAR_JUMP: { lastPos: 'closed', cooldown: false },
    BICEP_CURL: { stage: null, cooldown: false }
  };

  // Initialize MediaPipe Pose
  const initializePose = () => {
    const newPose = new window.Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    newPose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    newPose.onResults(onPoseResults);
    pose.current = newPose;
  };

  // Handle pose results with perfect video-landmark sync
  const onPoseResults = (results) => {
    setCurrentPose(results);
    
    if (canvasCtx.current && results.poseLandmarks) {
      canvasCtx.current.clearRect(0, 0, overlayCanvas.current.width, overlayCanvas.current.height);
      
      // Mirror the drawing to match video
      canvasCtx.current.save();
      canvasCtx.current.scale(-1, 1);
      canvasCtx.current.translate(-overlayCanvas.current.width, 0);
      
      // Draw with perfect alignment
      drawConnectors(canvasCtx.current, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
      drawLandmarks(canvasCtx.current, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});
      
      // Draw angles for better form visualization
      drawExerciseAngles(results.poseLandmarks);
      
      canvasCtx.current.restore();
      
      if (isTracking) {
        recognizeExercise(results.poseLandmarks);
      }
    }
  };

  // Draw angles relevant to current exercise
  const drawExerciseAngles = (landmarks) => {
    if (!landmarks) return;
    
    canvasCtx.current.fillStyle = "white";
    canvasCtx.current.font = "16px Arial";
    
    switch (activeWorkout) {
      case 'DEEP_SQUAT':
        // Draw knee angles
        const leftKneeAngle = calculateAngle(
          landmarks[bodyPoints.LEFT_HIP],
          landmarks[bodyPoints.LEFT_KNEE],
          landmarks[bodyPoints.LEFT_ANKLE]
        );
        const rightKneeAngle = calculateAngle(
          landmarks[bodyPoints.RIGHT_HIP],
          landmarks[bodyPoints.RIGHT_KNEE],
          landmarks[bodyPoints.RIGHT_ANKLE]
        );
        
        const leftKneePos = {
          x: landmarks[bodyPoints.LEFT_KNEE].x * overlayCanvas.current.width,
          y: landmarks[bodyPoints.LEFT_KNEE].y * overlayCanvas.current.height
        };
        const rightKneePos = {
          x: landmarks[bodyPoints.RIGHT_KNEE].x * overlayCanvas.current.width,
          y: landmarks[bodyPoints.RIGHT_KNEE].y * overlayCanvas.current.height
        };
        
        canvasCtx.current.fillText(Math.round(leftKneeAngle), leftKneePos.x, leftKneePos.y);
        canvasCtx.current.fillText(Math.round(rightKneeAngle), rightKneePos.x, rightKneePos.y);
        break;
        
      case 'BICEP_CURL':
        // Draw elbow angles
        const leftElbowAngle = calculateAngle(
          landmarks[bodyPoints.LEFT_SHOULDER],
          landmarks[bodyPoints.LEFT_ELBOW],
          landmarks[bodyPoints.LEFT_WRIST]
        );
        const rightElbowAngle = calculateAngle(
          landmarks[bodyPoints.RIGHT_SHOULDER],
          landmarks[bodyPoints.RIGHT_ELBOW],
          landmarks[bodyPoints.RIGHT_WRIST]
        );
        
        const leftElbowPos = {
          x: landmarks[bodyPoints.LEFT_ELBOW].x * overlayCanvas.current.width,
          y: landmarks[bodyPoints.LEFT_ELBOW].y * overlayCanvas.current.height
        };
        const rightElbowPos = {
          x: landmarks[bodyPoints.RIGHT_ELBOW].x * overlayCanvas.current.width,
          y: landmarks[bodyPoints.RIGHT_ELBOW].y * overlayCanvas.current.height
        };
        
        canvasCtx.current.fillText(Math.round(leftElbowAngle), leftElbowPos.x, leftElbowPos.y);
        canvasCtx.current.fillText(Math.round(rightElbowAngle), rightElbowPos.x, rightElbowPos.y);
        break;
        
      default:
        break;
    }
  };

  // Initialize camera with perfect mirroring
  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      if (videoElement.current) {
        videoElement.current.srcObject = stream;
        videoElement.current.style.transform = 'scaleX(-1)';
        
        await new Promise((resolve) => {
          videoElement.current.onloadedmetadata = () => {
            overlayCanvas.current.width = videoElement.current.videoWidth;
            overlayCanvas.current.height = videoElement.current.videoHeight;
            resolve();
          };
        });
      }
    } catch (error) {
      setFeedback("Camera access denied. Please enable camera permissions.");
    }
  };

  // Start tracking
  const startTracking = async () => {
    try {
      if (!pose.current) initializePose();
      await initializeCamera();
      
      camera.current = new window.Camera(videoElement.current, {
        onFrame: async () => {
          if (pose.current) await pose.current.send({image: videoElement.current});
        },
        width: 640,
        height: 480
      });
      
      await camera.current.start();
      setIsTracking(true);
      setFeedback(`${getExerciseName(activeWorkout)} tracking started! Position yourself in the camera view.`);
    } catch (error) {
      setFeedback("Failed to start tracking. Please try again.");
    }
  };

  // Stop tracking
  const stopTracking = () => {
    if (camera.current) camera.current.stop();
    if (videoElement.current?.srcObject) {
      videoElement.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsTracking(false);
    setFeedback(`Training session ended. Total reps: ${repetitionCount}. Great workout!`);
  };

  // Reset session
  const resetSession = () => {
    setRepetitionCount(0);
    setMovementPhase('ready');
    setIsInPosition(false);
    setFeedback(`${getExerciseName(activeWorkout)} session reset. Ready to start!`);
  };

  // Change workout type
  const changeWorkoutType = (newWorkout) => {
    if (isTracking) return;
    setActiveWorkout(newWorkout);
    resetSession();
  };

  // Get formatted exercise name
  const getExerciseName = (workout) => {
    return workout.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Exercise recognition
  const recognizeExercise = (landmarks) => {
    if (!landmarks) return;
    
    // First check visibility of key points
    const keypoints = [
      landmarks[bodyPoints.LEFT_SHOULDER],
      landmarks[bodyPoints.RIGHT_SHOULDER],
      landmarks[bodyPoints.LEFT_HIP],
      landmarks[bodyPoints.RIGHT_HIP],
      landmarks[bodyPoints.LEFT_KNEE],
      landmarks[bodyPoints.RIGHT_KNEE]
    ];
    
    const avgVisibility = keypoints.reduce((sum, point) => sum + (point?.visibility || 0), 0) / keypoints.length;
    
    if (avgVisibility < 0.7) {
      setFeedback("Low visibility. Adjust lighting or position");
      return;
    }
    
    switch (activeWorkout) {
      case 'DEEP_SQUAT': 
        checkSquat(landmarks); 
        break;
      case 'CHEST_PRESS': 
        checkPushup(landmarks); 
        break;
      case 'AB_CURL': 
        checkAbCurl(landmarks); 
        break;
      case 'STAR_JUMP': 
        checkJumpingJack(landmarks); 
        break;
      case 'BICEP_CURL': 
        checkBicepCurl(landmarks); 
        break;
      case 'TOE_TOUCH': 
        checkToeTouch(landmarks); 
        break;
      default: 
        break;
    }
  };

  // Enhanced squat detection
  const checkSquat = (landmarks) => {
    const leftHip = landmarks[bodyPoints.LEFT_HIP];
    const rightHip = landmarks[bodyPoints.RIGHT_HIP];
    const leftKnee = landmarks[bodyPoints.LEFT_KNEE];
    const rightKnee = landmarks[bodyPoints.RIGHT_KNEE];
    const leftAnkle = landmarks[bodyPoints.LEFT_ANKLE];
    const rightAnkle = landmarks[bodyPoints.RIGHT_ANKLE];
    const leftShoulder = landmarks[bodyPoints.LEFT_SHOULDER];
    const rightShoulder = landmarks[bodyPoints.RIGHT_SHOULDER];

    if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle || 
        !leftShoulder || !rightShoulder) return;

    // Calculate joint positions in pixel coordinates
    const canvasWidth = overlayCanvas.current.width;
    const canvasHeight = overlayCanvas.current.height;
    
    const avgHipY = ((leftHip.y + rightHip.y) / 2) * canvasHeight;
    const avgKneeY = ((leftKnee.y + rightKnee.y) / 2) * canvasHeight;
    const avgAnkleY = ((leftAnkle.y + rightAnkle.y) / 2) * canvasHeight;
    const avgShoulderY = ((leftShoulder.y + rightShoulder.y) / 2) * canvasHeight;

    // Calculate knee angles to detect proper squat form
    const leftKneeAngle = calculateAngle(
      [leftHip.x * canvasWidth, leftHip.y * canvasHeight],
      [leftKnee.x * canvasWidth, leftKnee.y * canvasHeight],
      [leftAnkle.x * canvasWidth, leftAnkle.y * canvasHeight]
    );
    
    const rightKneeAngle = calculateAngle(
      [rightHip.x * canvasWidth, rightHip.y * canvasHeight],
      [rightKnee.x * canvasWidth, rightKnee.y * canvasHeight],
      [rightAnkle.x * canvasWidth, rightAnkle.y * canvasHeight]
    );

    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    
    // More accurate squat detection using both hip position and knee angle
    const kneeAngleThreshold = 120; // Degrees - lower value means deeper bend
    const hipPositionThreshold = 0.2; // Relative to knee position
    
    const hipKneeDistance = avgKneeY - avgHipY;
    const kneeAnkleDistance = avgAnkleY - avgKneeY;
    
    // Hip should lower to close to knee level for a proper squat
    const hipLoweredEnough = hipKneeDistance < kneeAnkleDistance * hipPositionThreshold;
    
    // Check if user is in squat position (knees bent significantly and hips lowered)
    if (avgKneeAngle < kneeAngleThreshold && hipLoweredEnough && 
        exerciseStages.DEEP_SQUAT.lastPos === "up" && !exerciseStages.DEEP_SQUAT.cooldown) {
      // Valid squat detected
      setRepetitionCount(prev => prev + 1);
      setExerciseStats(prev => ({...prev, squats: prev.squats + 1}));
      exerciseStages.DEEP_SQUAT.lastPos = "down";
      exerciseStages.DEEP_SQUAT.cooldown = true;
      setMovementPhase('descending');
      setFeedback('Great squat! Keep your back straight as you stand up.');
      
      setTimeout(() => {
        exerciseStages.DEEP_SQUAT.cooldown = false;
      }, 800);
    } else if (avgKneeAngle > 160 && exerciseStages.DEEP_SQUAT.lastPos === "down") {
      // Standing up position detected
      exerciseStages.DEEP_SQUAT.lastPos = "up";
      setMovementPhase('ascending');
      setFeedback('Stand up straight, then squat down again.');
    }
  };

  // Enhanced pushup detection
  const checkPushup = (landmarks) => {
    const leftShoulder = landmarks[bodyPoints.LEFT_SHOULDER];
    const rightShoulder = landmarks[bodyPoints.RIGHT_SHOULDER];
    const leftElbow = landmarks[bodyPoints.LEFT_ELBOW];
    const rightElbow = landmarks[bodyPoints.RIGHT_ELBOW];
    const leftWrist = landmarks[bodyPoints.LEFT_WRIST];
    const rightWrist = landmarks[bodyPoints.RIGHT_WRIST];
    const leftHip = landmarks[bodyPoints.LEFT_HIP];
    const rightHip = landmarks[bodyPoints.RIGHT_HIP];

    if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || 
        !leftWrist || !rightWrist || !leftHip || !rightHip) return;

    // Calculate positions in pixel coordinates
    const canvasWidth = overlayCanvas.current.width;
    const canvasHeight = overlayCanvas.current.height;
    
    const leftShoulderPos = { x: leftShoulder.x * canvasWidth, y: leftShoulder.y * canvasHeight };
    const rightShoulderPos = { x: rightShoulder.x * canvasWidth, y: rightShoulder.y * canvasHeight };
    const leftElbowPos = { x: leftElbow.x * canvasWidth, y: leftElbow.y * canvasHeight };
    const rightElbowPos = { x: rightElbow.x * canvasWidth, y: rightElbow.y * canvasHeight };
    const leftWristPos = { x: leftWrist.x * canvasWidth, y: leftWrist.y * canvasHeight };
    const rightWristPos = { x: rightWrist.x * canvasWidth, y: rightWrist.y * canvasHeight };
    const leftHipPos = { x: leftHip.x * canvasWidth, y: leftHip.y * canvasHeight };
    const rightHipPos = { x: rightHip.x * canvasWidth, y: rightHip.y * canvasHeight };

    // Calculate shoulder and hip positions
    const avgShoulderY = (leftShoulderPos.y + rightShoulderPos.y) / 2;
    const avgHipY = (leftHipPos.y + rightHipPos.y) / 2;

    // Calculate elbow angles to detect pushup form
    const leftElbowAngle = calculateAngle(
      [leftShoulderPos.x, leftShoulderPos.y],
      [leftElbowPos.x, leftElbowPos.y],
      [leftWristPos.x, leftWristPos.y]
    );
    
    const rightElbowAngle = calculateAngle(
      [rightShoulderPos.x, rightShoulderPos.y],
      [rightElbowPos.x, rightElbowPos.y],
      [rightWristPos.x, rightWristPos.y]
    );

    const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    // Pushup detection logic
    const elbowAngleThreshold = 90; // Degrees - lower value means deeper pushup
    const shoulderHipDistanceThreshold = 0.2; // Relative to shoulder width
    
    // Check if user is in pushup position (elbows bent significantly and shoulders lowered)
    if (avgElbowAngle < elbowAngleThreshold && avgShoulderY > avgHipY && 
        exerciseStages.CHEST_PRESS.lastPos === "up" && !exerciseStages.CHEST_PRESS.cooldown) {
      // Valid pushup detected
      setRepetitionCount(prev => prev + 1);
      setExerciseStats(prev => ({...prev, pushups: prev.pushups + 1}));
      exerciseStages.CHEST_PRESS.lastPos = "down";
      exerciseStages.CHEST_PRESS.cooldown = true;
      setMovementPhase('lowering');
      setFeedback('Great pushup! Now push back up with control.');
      
      setTimeout(() => {
        exerciseStages.CHEST_PRESS.cooldown = false;
      }, 800);
    } else if (avgElbowAngle > 160 && exerciseStages.CHEST_PRESS.lastPos === "down") {
      // Standing up position detected
      exerciseStages.CHEST_PRESS.lastPos = "up";
      setMovementPhase('pushing');
      setFeedback('Push all the way up, then lower again.');
    }
  };

  // Bicep curl detection
  const checkBicepCurl = (landmarks) => {
    const leftShoulder = landmarks[bodyPoints.LEFT_SHOULDER];
    const leftElbow = landmarks[bodyPoints.LEFT_ELBOW];
    const leftWrist = landmarks[bodyPoints.LEFT_WRIST];
    
    if (!leftShoulder || !leftElbow || !leftWrist) return;
    
    // Get coordinates
    const shoulder = [
      leftShoulder.x * overlayCanvas.current.width,
      leftShoulder.y * overlayCanvas.current.height
    ];
    const elbow = [
      leftElbow.x * overlayCanvas.current.width,
      leftElbow.y * overlayCanvas.current.height
    ];
    const wrist = [
      leftWrist.x * overlayCanvas.current.width,
      leftWrist.y * overlayCanvas.current.height
    ];
    
    // Calculate angle
    const angle = calculateAngle(shoulder, elbow, wrist);
    
    // Curl counter logic
    if (angle > 160 && exerciseStages.BICEP_CURL.stage !== "down") {
      exerciseStages.BICEP_CURL.stage = "down";
      setMovementPhase('lowering');
      setFeedback('Lower the weight with control.');
    }
    if (angle < 30 && exerciseStages.BICEP_CURL.stage === "down" && !exerciseStages.BICEP_CURL.cooldown) {
      exerciseStages.BICEP_CURL.stage = "up";
      setRepetitionCount(prev => prev + 1);
      setExerciseStats(prev => ({...prev, curls: prev.curls + 1}));
      exerciseStages.BICEP_CURL.cooldown = true;
      setMovementPhase('curling');
      setFeedback('Great curl! Squeeze at the top.');
      
      setTimeout(() => {
        exerciseStages.BICEP_CURL.cooldown = false;
      }, 500);
    }
  };

  // Jumping jack detection
  const checkJumpingJack = (landmarks) => {
    const leftShoulder = landmarks[bodyPoints.LEFT_SHOULDER];
    const rightShoulder = landmarks[bodyPoints.RIGHT_SHOULDER];
    const leftWrist = landmarks[bodyPoints.LEFT_WRIST];
    const rightWrist = landmarks[bodyPoints.RIGHT_WRIST];
    const leftAnkle = landmarks[bodyPoints.LEFT_ANKLE];
    const rightAnkle = landmarks[bodyPoints.RIGHT_ANKLE];
    const leftHip = landmarks[bodyPoints.LEFT_HIP];
    const rightHip = landmarks[bodyPoints.RIGHT_HIP];

    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist || 
        !leftAnkle || !rightAnkle || !leftHip || !rightHip) return;

    // Calculate positions in pixel coordinates
    const canvasWidth = overlayCanvas.current.width;
    const canvasHeight = overlayCanvas.current.height;
    
    // Track wrists (hands) instead of shoulders for more accurate detection
    const leftWristPos = { x: leftWrist.x * canvasWidth, y: leftWrist.y * canvasHeight };
    const rightWristPos = { x: rightWrist.x * canvasWidth, y: rightWrist.y * canvasHeight };
    const leftShoulderPos = { x: leftShoulder.x * canvasWidth, y: leftShoulder.y * canvasHeight };
    const rightShoulderPos = { x: rightShoulder.x * canvasWidth, y: rightShoulder.y * canvasHeight };
    const leftAnklePos = { x: leftAnkle.x * canvasWidth, y: leftAnkle.y * canvasHeight };
    const rightAnklePos = { x: rightAnkle.x * canvasWidth, y: rightAnkle.y * canvasHeight };
    const leftHipPos = { x: leftHip.x * canvasWidth, y: leftHip.y * canvasHeight };
    const rightHipPos = { x: rightHip.x * canvasWidth, y: rightHip.y * canvasHeight };

    // Calculate horizontal distance between feet
    const feetDistance = Math.abs(leftAnklePos.x - rightAnklePos.x);
    const hipDistance = Math.abs(leftHipPos.x - rightHipPos.x);
    
    // Normalize feet distance relative to hip width to account for different camera distances
    const normalizedFeetDistance = feetDistance / hipDistance;
    
    // Calculate hands positions relative to shoulders
    // In jumping jacks, hands go above shoulders
    const leftHandAboveShoulder = leftWristPos.y < leftShoulderPos.y;
    const rightHandAboveShoulder = rightWristPos.y < rightShoulderPos.y;
    
    // Calculate horizontal distance between hands
    const handsDistance = Math.abs(leftWristPos.x - rightWristPos.x);
    const shoulderDistance = Math.abs(leftShoulderPos.x - rightShoulderPos.x);
    
    // Hands should be wide apart in the "open" position
    // Normalize to shoulder width to account for different body sizes
    const normalizedHandsDistance = handsDistance / shoulderDistance;
    
    // Define thresholds for jumping jack detection
    const feetApartThreshold = 1.5; // Feet should be wider than hip width
    const handsApartThreshold = 1.8; // Hands should be wider than shoulder width
    
    // Check if in "open" position (hands up and feet apart)
    const inOpenPosition = 
      leftHandAboveShoulder && 
      rightHandAboveShoulder && 
      normalizedHandsDistance > handsApartThreshold && 
      normalizedFeetDistance > feetApartThreshold;
      
    // Check if in "closed" position (hands down and feet together)
    const inClosedPosition = 
      !leftHandAboveShoulder && 
      !rightHandAboveShoulder && 
      normalizedFeetDistance < 1.2;
    
    // Count jumping jack when transitioning from closed to open position
    if (inOpenPosition && exerciseStages.STAR_JUMP.lastPos === "closed" && !exerciseStages.STAR_JUMP.cooldown) {
      setRepetitionCount(prev => prev + 1);
      setExerciseStats(prev => ({...prev, jumpingJacks: prev.jumpingJacks + 1}));
      exerciseStages.STAR_JUMP.lastPos = "open";
      exerciseStages.STAR_JUMP.cooldown = true;
      setMovementPhase('jumping');
      setFeedback('Great form! Arms up and legs wide.');
      
      setTimeout(() => {
        exerciseStages.STAR_JUMP.cooldown = false;
      }, 500);
    } else if (inClosedPosition && exerciseStages.STAR_JUMP.lastPos === "open") {
      exerciseStages.STAR_JUMP.lastPos = "closed";
      setMovementPhase('landing');
      setFeedback('Bring your arms down and legs together.');
    }
  };

  // Toe touch detection
  const checkToeTouch = (landmarks) => {
    const leftShoulder = landmarks[bodyPoints.LEFT_SHOULDER];
    const rightShoulder = landmarks[bodyPoints.RIGHT_SHOULDER];
    const leftHip = landmarks[bodyPoints.LEFT_HIP];
    const rightHip = landmarks[bodyPoints.RIGHT_HIP];
    const leftWrist = landmarks[bodyPoints.LEFT_WRIST];
    const rightWrist = landmarks[bodyPoints.RIGHT_WRIST];
    const leftAnkle = landmarks[bodyPoints.LEFT_ANKLE];
    const rightAnkle = landmarks[bodyPoints.RIGHT_ANKLE];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip || 
        !leftWrist || !rightWrist || !leftAnkle || !rightAnkle) return;

    // Calculate positions in pixel coordinates
    const canvasWidth = overlayCanvas.current.width;
    const canvasHeight = overlayCanvas.current.height;

    const leftWristPos = { x: leftWrist.x * canvasWidth, y: leftWrist.y * canvasHeight };
    const rightWristPos = { x: rightWrist.x * canvasWidth, y: rightWrist.y * canvasHeight };
    const leftAnklePos = { x: leftAnkle.x * canvasWidth, y: leftAnkle.y * canvasHeight };
    const rightAnklePos = { x: rightAnkle.x * canvasWidth, y: rightAnkle.y * canvasHeight };

    // Check if wrist is close to opposite ankle (toe touch position)
    const leftWristToRightAnkleDistance = Math.sqrt(
      Math.pow(leftWristPos.x - rightAnklePos.x, 2) + 
      Math.pow(leftWristPos.y - rightAnklePos.y, 2)
    );
    const rightWristToLeftAnkleDistance = Math.sqrt(
      Math.pow(rightWristPos.x - leftAnklePos.x, 2) + 
      Math.pow(rightWristPos.y - leftAnklePos.y, 2)
    );

    const toeTouchThreshold = 50; // Distance threshold in pixels

    // Alternate toe touch detection logic
    if ((leftWristToRightAnkleDistance < toeTouchThreshold || 
         rightWristToLeftAnkleDistance < toeTouchThreshold) && 
        exerciseStages.TOE_TOUCH.lastPos === "up" && !exerciseStages.TOE_TOUCH.cooldown) {
      setRepetitionCount(prev => prev + 1);
      setExerciseStats(prev => ({...prev, toeTouches: prev.toeTouches + 1}));
      exerciseStages.TOE_TOUCH.lastPos = "down";
      exerciseStages.TOE_TOUCH.cooldown = true;
      setMovementPhase('touching');
      setFeedback('Great stretch! Reach for your toes.');
      
      setTimeout(() => {
        exerciseStages.TOE_TOUCH.cooldown = false;
      }, 500);
    } else if (leftWristToRightAnkleDistance > toeTouchThreshold && 
               rightWristToLeftAnkleDistance > toeTouchThreshold && 
               exerciseStages.TOE_TOUCH.lastPos === "down") {
      exerciseStages.TOE_TOUCH.lastPos = "up";
      setMovementPhase('standing');
      setFeedback('Stand up straight, then reach for the opposite toe.');
    }
  };

  // Ab curl detection
  const checkAbCurl = (landmarks) => {
    const leftShoulder = landmarks[bodyPoints.LEFT_SHOULDER];
    const leftHip = landmarks[bodyPoints.LEFT_HIP];
    
    if (leftShoulder && leftHip) {
      const angle = Math.abs(leftHip.y - leftShoulder.y);
      
      if (angle > 0.2 && !isInPosition) {
        setIsInPosition(true);
        setMovementPhase('curling');
        setFeedback('Curling up... Engage your core!');
      } else if (angle < 0.1 && isInPosition) {
        completeRep();
      }
    }
  };

  const completeRep = () => {
    const currentTime = Date.now();
    if (currentTime - lastRepTime > 1000) {
      setRepetitionCount(prev => prev + 1);
      setLastRepTime(currentTime);
      setIsInPosition(false);
      setMovementPhase('completed');
      setFeedback(`Great ${getExerciseName(activeWorkout).toLowerCase()}! Rep ${repetitionCount + 1} completed!`);
    }
  };

  // Calculate angle between three points
  const calculateAngle = (a, b, c) => {
    // Convert to coordinates if landmarks
    const p1 = Array.isArray(a) ? a : [a.x, a.y];
    const p2 = Array.isArray(b) ? b : [b.x, b.y];
    const p3 = Array.isArray(c) ? c : [c.x, c.y];
    
    // Calculate vectors
    const vector1 = [p1[0] - p2[0], p1[1] - p2[1]];
    const vector2 = [p3[0] - p2[0], p3[1] - p2[1]];
    
    // Calculate dot product
    const dotProduct = vector1[0] * vector2[0] + vector1[1] * vector2[1];
    
    // Calculate magnitudes
    const magnitude1 = Math.sqrt(vector1[0] * vector1[0] + vector1[1] * vector1[1]);
    const magnitude2 = Math.sqrt(vector2[0] * vector2[0] + vector2[1] * vector2[1]);
    
    // Calculate angle in radians and convert to degrees
    const angleRadians = Math.acos(dotProduct / (magnitude1 * magnitude2));
    const angleDegrees = angleRadians * (180 / Math.PI);
    
    return angleDegrees;
  };

  // Drawing helpers
  const drawConnectors = (ctx, landmarks, connections, options) => {
    ctx.strokeStyle = options.color;
    ctx.lineWidth = options.lineWidth;
    connections.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
        ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
        ctx.stroke();
      }
    });
  };

  const drawLandmarks = (ctx, landmarks, options) => {
    ctx.fillStyle = options.color;
    landmarks.forEach(landmark => {
      if (landmark) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * ctx.canvas.width,
          landmark.y * ctx.canvas.height,
          options.lineWidth + 1,
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    });
  };

  // Load scripts and initialize
  useEffect(() => {
    const loadScripts = async () => {
      const scripts = [
        'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'
      ];

      for (const src of scripts) {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        document.body.appendChild(script);
      }
    };

    loadScripts();
    if (overlayCanvas.current) {
      canvasCtx.current = overlayCanvas.current.getContext('2d');
    }

    return () => {
      if (videoElement.current?.srcObject) {
        videoElement.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="fitness-app">
      <div className="container">
        <h1 className="main-title">AI FITNESS COACH</h1>
        
        {/* Exercise Selection */}
        <div className="exercise-section">
          <h2 className="section-title">Choose Your Exercise:</h2>
          <div className="exercise-grid">
            <button 
              className={`exercise-btn ${activeWorkout === 'DEEP_SQUAT' ? 'active' : ''}`} 
              onClick={() => changeWorkoutType('DEEP_SQUAT')}
              disabled={isTracking}
            >
              Deep Squat
            </button>
            <button 
              className={`exercise-btn ${activeWorkout === 'CHEST_PRESS' ? 'active' : ''}`} 
              onClick={() => changeWorkoutType('CHEST_PRESS')}
              disabled={isTracking}
            >
              Chest Press
            </button>
            <button 
              className={`exercise-btn ${activeWorkout === 'AB_CURL' ? 'active' : ''}`} 
              onClick={() => changeWorkoutType('AB_CURL')}
              disabled={isTracking}
            >
              Ab Curl
            </button>
            <button 
              className={`exercise-btn ${activeWorkout === 'STAR_JUMP' ? 'active' : ''}`} 
              onClick={() => changeWorkoutType('STAR_JUMP')}
              disabled={isTracking}
            >
              Star Jump
            </button>
            <button 
              className={`exercise-btn ${activeWorkout === 'BICEP_CURL' ? 'active' : ''}`} 
              onClick={() => changeWorkoutType('BICEP_CURL')}
              disabled={isTracking}
            >
              Bicep Curl
            </button>
            <button 
              className={`exercise-btn ${activeWorkout === 'TOE_TOUCH' ? 'active' : ''}`} 
              onClick={() => changeWorkoutType('TOE_TOUCH')}
              disabled={isTracking}
            >
              Toe Touch
            </button>
          </div>
        </div>
        
        {/* Workout Statistics */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">CURRENT EXERCISE</div>
            <div className="stat-value">{getExerciseName(activeWorkout)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label green">REPETITIONS</div>
            <div className="stat-value green">{repetitionCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label purple">PHASE</div>
            <div className="stat-value">{movementPhase}</div>
          </div>
        </div>
        
        {/* Feedback Display */}
        <div className="feedback-display">
          <p>{feedback}</p>
        </div>
        
        {/* Video Container */}
        <div className="video-container">
          <video 
            ref={videoElement} 
            className="video-element" 
            autoPlay 
            muted 
            playsInline
            style={{ display: isTracking ? 'block' : 'none' }}
          />
          <canvas ref={overlayCanvas} className="overlay-canvas" />
          
          {!isTracking && (
            <div className="video-placeholder">
              <div className="camera-icon">
                <svg width="80" height="80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="video-title">Camera Feed</p>
              <p className="video-subtitle">Click 'Start Training' to access your camera</p>
            </div>
          )}
          
          {/* Rep Counter Overlay */}
          <div className="rep-counter">
            <span className="rep-number">{repetitionCount}</span>
            <span className="rep-label">REPS</span>
          </div>
          
          {/* Status Indicator */}
          <div className="status-indicator">
            <div className={`status-dot ${isTracking ? 'active' : ''}`} />
            <span className="status-text">{isTracking ? 'TRACKING' : 'STOPPED'}</span>
          </div>
        </div>
        
        {/* Control Buttons */}
        <div className="controls">
          <button 
            className={`control-btn ${isTracking ? 'danger' : 'success'}`} 
            onClick={isTracking ? stopTracking : startTracking}
          >
            {isTracking ? 'End Training' : 'Start Training'}
          </button>
          <button 
            className={`control-btn ${showPoseData ? 'warning' : 'secondary'}`}
            onClick={() => setShowPoseData(!showPoseData)}
          >
            {showPoseData ? 'Hide Pose Data' : 'Show Pose Data'}
          </button>
          <button 
            className="control-btn primary"
            onClick={resetSession}
          >
            Reset Session
          </button>
        </div>
        
        {/* Pose Data Display */}
        {showPoseData && (
          <div className="pose-data-section">
            <h3 className="pose-data-title">Body Pose Analysis</h3>
            <p className="pose-data-description">Click on any body point to view detailed coordinates</p>
            <div className="pose-points-grid">
              {renderPoseData()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FitnessTracker;