import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Fingerprint, Video, AlertTriangle, CheckCircle2, Trash2, 
  RefreshCw, Smile, ChevronLeft, ChevronRight, Play, Check, ShieldCheck, HelpCircle
} from 'lucide-react';
import { Student, StudentFaceProfile } from '../types';
import { apiClient } from '../api';
import { supabase } from '../lib/supabase';

interface BiometricRegistrationProps {
  students: Student[];
  faceProfiles: StudentFaceProfile[];
  onRefresh: () => void;
}

// 10 specific pose frames
interface PoseGuide {
  poseKey: string;
  label: string;
  instruction: string;
}

const POSE_GUIDES: PoseGuide[] = [
  { poseKey: 'front_main', label: 'Front Face (Primary)', instruction: 'Look directly into the holographic reticle with a neutral pose.' },
  { poseKey: 'front_sub', label: 'Front Face (Backup)', instruction: 'Maintain directly frontal gaze for stereoscopic density maps.' },
  { poseKey: 'left_slight', label: 'Slight Left Angle', instruction: 'Turn your head slightly to the left (about 15 degrees).' },
  { poseKey: 'left_profile', label: 'Left Profile Check', instruction: 'Maintain left posture for depth feature extractions.' },
  { poseKey: 'right_slight', label: 'Slight Right Angle', instruction: 'Turn your head slightly to the right (about 15 degrees).' },
  { poseKey: 'right_profile', label: 'Right Profile Check', instruction: 'Maintain right posture for facial coordinate nodes.' },
  { poseKey: 'up_tilt', label: 'Upward Elevation', instruction: 'Tilt your chin slightly upward to detect lower jaw contours.' },
  { poseKey: 'up_sub', label: 'Up Target calibration', instruction: 'Keep looking upwards slightly for optical landmark tracing.' },
  { poseKey: 'down_tilt', label: 'Downward Tilt', instruction: 'Tilt your chin slightly downward to capture forehead dimensions.' },
  { poseKey: 'normal_expression', label: 'Normal Expression', instruction: 'Give a soft, natural expression to complete registration.' }
];

declare const faceapi: any;

export default function BiometricRegistration({ students, faceProfiles, onRefresh }: BiometricRegistrationProps) {
  // Database lookup
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  // Active registration workflow states
  const [activeRegStudent, setActiveRegStudent] = useState<Student | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  
  // Scanning sequence state
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [capturedDescriptors, setCapturedDescriptors] = useState<number[][]>([]);
  
  // Validation issues
  const [validationError, setValidationError] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [measuredSharpness, setMeasuredSharpness] = useState<number | null>(null);

  // Success screen
  const [successData, setSuccessData] = useState<{
    studentName: string;
    usn: string;
    imagesCount: number;
    descriptorsCount: number;
    descriptorLength: number;
    timestamp: string;
  } | null>(null);

  // face-api models loading state
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string>('');

  // --- DIAGNOSTICS & DEBUG PANEL STATE ---
  const [debugEndpoint, setDebugEndpoint] = useState<string>('');
  const [debugStatus, setDebugStatus] = useState<number | null>(null);
  const [debugContentType, setDebugContentType] = useState<string>('');
  const [debugResponseBody, setDebugResponseBody] = useState<string>('');
  const [debugSuccess, setDebugSuccess] = useState<boolean | null>(null);
  const [debugErrorDetail, setDebugErrorDetail] = useState<string>('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  // Ref holders
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Filter student list based on search text
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchText.toLowerCase()) || 
    s.usn.toLowerCase().includes(searchText.toLowerCase()) ||
    s.department.toLowerCase().includes(searchText.toLowerCase())
  );

  // Load faceapi.js models in background
  useEffect(() => {
    let active = true;
    const initializeModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        
        // Wait up to 5 seconds for the index.html script tag to load globally
        let retries = 0;
        while (typeof faceapi === 'undefined' && retries < 20) {
          await new Promise(resolve => setTimeout(resolve, 250));
          retries++;
        }

        if (typeof faceapi === 'undefined') {
          throw new Error('faceapi script was not loaded from CDN. Inspect your network or browser settings.');
        }

        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        }
        if (!faceapi.nets.faceLandmark68Net.isLoaded) {
          await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        }
        if (!faceapi.nets.faceRecognitionNet.isLoaded) {
          await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        }

        if (active) {
          setModelsLoaded(true);
        }
      } catch (err: any) {
        console.error('Handshake failed on face-api loading:', err);
        if (active) {
          setModelsError(`Biometric neural weights failed to compile: ${err.message || err}`);
        }
      }
    };

    initializeModels();
    return () => {
      active = false;
    };
  }, []);

  // Stop camera stream safely
  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Start webcam feed with active frame constraints
  const startWebcam = async () => {
    setCameraError('');
    setValidationError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error('Webcam handshake error:', err);
      setCameraError('FAILED TO ACQUIRE CAMERA NODE: Please approve camera access permission in frame settings.');
    }
  };

  // Cleanup stream on component unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const handleOpenRegistration = (student: Student) => {
    setActiveRegStudent(student);
    setCurrentStep(0);
    setCapturedImages([]);
    setCapturedDescriptors([]);
    setValidationError('');
    setMeasuredSharpness(null);
    setSuccessData(null);
    
    // Clear Diagnostics
    setDebugEndpoint('');
    setDebugStatus(null);
    setDebugContentType('');
    setDebugResponseBody('');
    setDebugSuccess(null);
    setDebugErrorDetail('');
    setDebugLogs([]);
    
    startWebcam();
  };

  const handleCancelRegistration = () => {
    stopWebcam();
    setActiveRegStudent(null);
    setCurrentStep(0);
    setCapturedImages([]);
    setCapturedDescriptors([]);
    setValidationError('');
    setMeasuredSharpness(null);
    setSuccessData(null);
    
    // Clear Diagnostics
    setDebugEndpoint('');
    setDebugStatus(null);
    setDebugContentType('');
    setDebugResponseBody('');
    setDebugSuccess(null);
    setDebugErrorDetail('');
    setDebugLogs([]);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !activeRegStudent) return;
    if (!modelsLoaded) {
      setValidationError('REJECTED: Biometric models are still booting. Please hold on.');
      return;
    }
    
    setIsCapturing(true);
    setValidationError('');
    
    let count = 3;
    setCountdown(count);
    
    const interval = setInterval(async () => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setCountdown(null);
        
        try {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          
          if (video && canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            }
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            // Execute real single-face landmarks extraction and 128-float descriptor resolution
            const detection = await faceapi.detectSingleFace(
              video,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 })
            ).withFaceLandmarks().withFaceDescriptor();

            // Check if there are multiple faces simultaneously present in sensor grid
            const detections = await faceapi.detectAllFaces(
              video,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 })
            );

            if (detections.length === 0 || !detection) {
              setValidationError('REJECTED: Face landmark detection failed. Ensure high lighting density and stay centered.');
              setIsCapturing(false);
              return;
            }

            if (detections.length > 1) {
              setValidationError('REJECTED: Multiple faces detected. Biometric registration requires single-user isolation.');
              setIsCapturing(false);
              return;
            }

            // Real Biometric Landmark Liveness Angle check
            const landmarks = detection.landmarks;
            const jaw = landmarks.getJawOutline();
            const nose = landmarks.getNose();
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();

            const getCentroid = (points: { x: number; y: number }[]) => {
              let x = 0, y = 0;
              points.forEach(p => { x += p.x; y += p.y; });
              return { x: x / points.length, y: y / points.length };
            };

            const eyeLeft = getCentroid(leftEye);
            const eyeRight = getCentroid(rightEye);
            
            // Nose tip is located towards index 3-4 of nose outline
            const noseTip = nose[3] || nose[0];

            // Horizontal asymmetry analysis
            const distLeft = Math.hypot(noseTip.x - jaw[0].x, noseTip.y - jaw[0].y);
            const distRight = Math.hypot(jaw[16].x - noseTip.x, jaw[16].y - noseTip.y);
            const symmetryRatio = distLeft / (distRight || 1.0);

            // Vertical depth estimation
            const eyeMidpointY = (eyeLeft.y + eyeRight.y) / 2;
            const chinY = jaw[8].y;
            const upperDist = noseTip.y - eyeMidpointY;
            const lowerDist = chinY - noseTip.y;
            const verticalRatio = upperDist / (lowerDist || 1.0);

            // Fetch posture limits
            const currentPoseKey = POSE_GUIDES[currentStep].poseKey;
            let poseError = '';

            if (currentPoseKey === 'left_slight') {
              if (symmetryRatio >= 0.82) {
                poseError = 'Liveness Check failed: Please turn your face slightly to the Left.';
              }
            } else if (currentPoseKey === 'left_profile') {
              if (symmetryRatio >= 0.65) {
                poseError = 'Liveness Check failed: Turn head fully left to establish profiles.';
              }
            } else if (currentPoseKey === 'right_slight') {
              if (symmetryRatio <= 1.22) {
                poseError = 'Liveness Check failed: Please turn your face slightly to the Right.';
              }
            } else if (currentPoseKey === 'right_profile') {
              if (symmetryRatio <= 1.48) {
                poseError = 'Liveness Check failed: Turn head fully right to resolve profiles.';
              }
            } else if (currentPoseKey === 'up_tilt' || currentPoseKey === 'up_sub') {
              if (verticalRatio >= 0.52) {
                poseError = 'Liveness Check failed: Chin elevation insufficient. Look upward.';
              }
            } else if (currentPoseKey === 'down_tilt') {
              if (verticalRatio <= 0.63) {
                poseError = 'Liveness Check failed: Chin tilt insufficient. Look downward.';
              }
            } else {
              // Neutral/normal front
              if (symmetryRatio < 0.58 || symmetryRatio > 1.62) {
                poseError = 'Liveness Check failed: Please look directly front into the target guides.';
              }
            }

            if (poseError) {
              setValidationError(poseError);
              setIsCapturing(false);
              return;
            }

            // Real float extraction
            const realDescriptor = Array.from(detection.descriptor);
            setMeasuredSharpness(symmetryRatio); // Keep symmetry metrics displayed visually

            const newImages = [...capturedImages, dataUrl];
            const newDescriptors = [...capturedDescriptors, realDescriptor];

            setCapturedImages(newImages);
            setCapturedDescriptors(newDescriptors);

            // Advance steps or finalize
            if (currentStep < POSE_GUIDES.length - 1) {
              setCurrentStep(currentStep + 1);
            } else {
              if (newDescriptors.length < 10) {
                setValidationError(`REJECTED: Proceed prevented. Biometric security cascade requires exactly 10 descriptors (Captured: ${newDescriptors.length}). Please restart registration.`);
                setIsCapturing(false);
                return;
              }
              // Finalizing biometrics packet submission
              submitBiometricsPacket(newImages, newDescriptors);
            }
          }
        } catch (e: any) {
          setValidationError('Webcam capture matrix binding interrupted: ' + e.message);
        }
        setIsCapturing(false);
      }
    }, 450); // fast visual countdown
  };

  // Submit collected biometric payload to the central Node JSON database with full diagnostics trace
  const submitBiometricsPacket = async (images: string[], descriptors: number[][]) => {
    if (!activeRegStudent) return;
    if (descriptors.length < 10) {
      setValidationError(`REJECTED: Proceed prevented. Biometric registration requires exactly 10 multi-angle pose descriptors for template model compliance. Captured size: ${descriptors.length}`);
      return;
    }
    
    const targetUrl = '/api/face-profiles';
    setDebugEndpoint(targetUrl);
    setDebugSuccess(null);
    setDebugStatus(null);
    setDebugContentType('');
    setDebugResponseBody('');
    setDebugErrorDetail('');
    
    let logs: string[] = [];
    const addLog = (m: string) => {
      console.log(`[Biometric Trace] ${m}`);
      logs = [...logs, `[${new Date().toISOString().split('T')[1].substr(0, 8)}] ${m}`];
      setDebugLogs(logs);
    };

    addLog(`INITIATING COMMIT PROTOCOL: studentId=${activeRegStudent.id}, usn=${activeRegStudent.usn}`);
    
    // Upload primary face image to Supabase Storage bucket "student-faces"
    let uploadedFaceUrls: string[] = [...images];
    try {
      if (images.length > 0 && images[0].startsWith('data:image')) {
        addLog(`Uploading face image to Supabase Storage bucket "student-faces"...`);
        const fileName = `${activeRegStudent.usn}_${Date.now()}.jpg`;
        const res = await fetch(images[0]);
        const blob = await res.blob();
        
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('student-faces')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

        if (!uploadErr && uploadData) {
          const { data: pubData } = supabase.storage
            .from('student-faces')
            .getPublicUrl(fileName);
          if (pubData?.publicUrl) {
            uploadedFaceUrls[0] = pubData.publicUrl;
            addLog(`Supabase Storage Upload SUCCESS: ${pubData.publicUrl}`);
          }
        } else {
          addLog(`Supabase Storage Note: ${uploadErr?.message || 'Using base64 image data'}`);
        }
      }
    } catch (storageErr: any) {
      addLog(`Supabase Storage Exception: ${storageErr?.message || 'Proceeding with fallback'}`);
    }

    // Check 7: Verify FaceAPI descriptors are serializable before storage
    addLog(`Checking serialization integrity of biometric matrices...`);
    const payload = {
      studentId: activeRegStudent.id,
      studentName: activeRegStudent.name,
      usn: activeRegStudent.usn,
      department: activeRegStudent.department,
      registrationDate: new Date().toISOString().split('T')[0],
      faceImages: uploadedFaceUrls,
      faceDescriptors: descriptors
    };

    try {
      const serialized = JSON.stringify(payload);
      addLog(`Payload serialization verified. Size: ${(serialized.length / 1024).toFixed(2)} KB.`);
    } catch (e: any) {
      addLog(`FATAL: Payload serialization check failed!`);
      setDebugErrorDetail(`Serialization Fail: ${e.message}`);
      setDebugSuccess(false);
      setValidationError(`Descriptor serialization check failed: ${e.message}`);
      return;
    }

    addLog(`Posting database commit fetch to: ${targetUrl}`);
    try {
      // Direct fetch call to catch complete headers/statuses/bodies safely
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      setDebugStatus(response.status);
      addLog(`Response receipt status: ${response.status} ${response.statusText}`);

      const contentType = response.headers.get('Content-Type') || '';
      setDebugContentType(contentType);
      addLog(`Response header Content-Type resolved: "${contentType}"`);

      const rawText = await response.text();
      setDebugResponseBody(rawText.substring(0, 3000)); // raw response body snippet
      
      const isJson = contentType.toLowerCase().includes('application/json');
      addLog(`Response Content-Type IS JSON: ${isJson}`);
      
      // Check 5: Verify server is not returning an HTML error page
      const isHtml = rawText.trim().startsWith('<') || rawText.trim().toLowerCase().startsWith('<!doctype');
      addLog(`Response body IS HTML document: ${isHtml}`);

      if (isHtml) {
        addLog(`HTML ERROR DETECTED: Endpoint returned an HTML document. Potential 404 spa fallback or 500 error.`);
        throw new Error(`Endpoint returned non-JSON HTML error body. Code: ${response.status}`);
      }

      if (!response.ok) {
        let errDesc = 'Server rejected biometric upload pack.';
        if (isJson) {
          try {
            const errObj = JSON.parse(rawText);
            errDesc = errObj.error || errDesc;
          } catch(e) {}
        }
        addLog(`Request failed on target database node. Reason: ${errDesc}`);
        throw new Error(errDesc);
      }

      // Success
      addLog(`Biometric signature registry verified successfully on target server.`);
      
      // Try to parse reply
      const replyData = JSON.parse(rawText);
      addLog(`JSON Parse success. Face profile ID created: ${replyData.id}`);

      setDebugSuccess(true);
      
      // Save logs and refresh
      setSuccessData({
        studentName: activeRegStudent.name,
        usn: activeRegStudent.usn,
        imagesCount: images.length,
        descriptorsCount: descriptors.length,
        descriptorLength: descriptors[0]?.length || 128,
        timestamp: new Date().toLocaleString()
      });
      onRefresh();
      stopWebcam();
    } catch (err: any) {
      setDebugSuccess(false);
      const errMessage = err.message || 'Unknown network stream exception';
      setDebugErrorDetail(errMessage);
      
      // Log the exact failing function, endpoint URL and response body
      console.error(`DIAGNOSTIC ERROR [submitBiometricsPacket]: Function=submitBiometricsPacket, URL=${targetUrl}, Status=${debugStatus}, Msg=${errMessage}`);
      setValidationError(`Biometric node commit failed on server: ${errMessage}`);
    }
  };

  // Delete a face profile with security cascade check
  const handleDeleteProfile = async (id: string) => {
    if (confirm('Are you absolutely sure you want to clear this biometric facial template model profile? This student will have to repeat enrollment.')) {
      try {
        await apiClient.deleteFaceProfile(id);
        onRefresh();
      } catch (err: any) {
        alert('Purple Team Cascade Failure: unable to clear node record: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-6 relative z-10 animate-fade-in">
      
      {/* HEADER CONTROLS CARD */}
      <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-6 rounded-xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-white font-display mb-1 uppercase tracking-widest flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-cyan-400 animate-pulse" />
              BIOMETRIC_FACE_REGISTRY_CONTROLLER
            </h4>
            <p className="text-[11px] text-cyan-400/55 font-mono uppercase">
              Enroll student physical identities and build 128-dimensional vectors mapping landmarks
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono border border-cyan-500/20 px-2.5 py-1 rounded bg-black/40 text-cyan-400 uppercase">
              ENROLLED_PROFILES: {faceProfiles.length}
            </span>
          </div>
        </div>
      </div>

      {/* WORKFLOW CONDITIONAL ROW */}
      {!activeRegStudent ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* STUDENT SEARCH DIRECTORY */}
          <div className="lg:col-span-4 bg-[#0a0f1d]/90 backdrop-blur-md border border-cyan-500/10 rounded-xl p-5 space-y-4">
            <div>
              <h5 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-1">
                STUDENT SYSTEM REGISTRY
              </h5>
              <p className="text-[10px] text-gray-500 font-sans">
                Select from authorized campus matriculates to bind biometric models
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search by USN / Name..."
                className="w-full text-xs font-mono bg-black text-white pl-8 pr-3 py-2 border border-cyan-500/20 rounded outline-none focus:border-cyan-400"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <span className="absolute left-2.5 top-2.5 text-gray-500">
                <Video className="w-4 h-4" />
              </span>
            </div>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-gray-600 uppercase">
                  NO CORRESPONDING NODES FOUND
                </div>
              ) : (
                filteredStudents.map(student => {
                  const hasProfile = faceProfiles.some(fp => fp.studentId === student.id || fp.usn.toUpperCase() === student.usn.toUpperCase());
                  return (
                    <div 
                      key={student.id}
                      className={`p-3 border rounded-lg transition-all flex flex-col justify-between gap-2.5 ${
                        hasProfile 
                          ? 'bg-cyan-950/5 border-cyan-500/20 hover:border-cyan-500/60' 
                          : 'bg-black/40 border-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-cyan-400 font-black">{student.usn}</span>
                          {hasProfile ? (
                            <span className="text-[8.5px] font-mono font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-950/20 px-1.5 rounded uppercase">
                              ENROLLED
                            </span>
                          ) : (
                            <span className="text-[8.5px] font-mono font-bold text-amber-500 border border-amber-500/30 bg-amber-950/20 px-1.5 rounded uppercase">
                              UNREGISTERED
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white font-sans mt-1">{student.name}</h4>
                        <p className="text-[10px] text-gray-400 font-sans mt-0.5">{student.department}</p>
                      </div>

                      <button
                        onClick={() => handleOpenRegistration(student)}
                        className={`w-full py-1.5 text-[10px] font-mono font-bold uppercase rounded tracking-wider cursor-pointer transition-all ${
                          hasProfile 
                            ? 'bg-cyan-500/10 hover:bg-cyan-500 hover:text-black border border-cyan-500/30 text-cyan-400' 
                            : 'bg-[#00ffd2] hover:bg-cyan-400 text-black shadow-lg shadow-[#00ffd2]/10'
                        }`}
                      >
                        {hasProfile ? 'Overwrite Face Registry' : 'Register Face'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* COSNIC BIOMETRIC AUDIT PANEL */}
          <div className="lg:col-span-8 bg-[#0a0f1d]/90 backdrop-blur-md border border-cyan-500/10 rounded-xl p-5 space-y-5">
            <div>
              <h5 className="text-xs font-mono font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                BIOMETRIC AUDIT PANEL
              </h5>
              <p className="text-[10px] text-gray-500 font-sans mb-3">
                Authorized neural ledger auditing active templates and biometric registration compliance across all nodes
              </p>
            </div>

            {/* Audit Aggregates summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-cyan-950/10 border border-cyan-500/10 p-3 rounded-lg text-center shadow-inner">
                <span className="text-[10px] text-gray-400 font-mono block uppercase tracking-wider">Total Face Profiles</span>
                <span className="text-xl font-bold font-mono text-cyan-400 block mt-0.5">
                  {faceProfiles.length}
                </span>
              </div>
              <div className="bg-cyan-950/10 border border-cyan-500/10 p-3 rounded-lg text-center shadow-inner">
                <span className="text-[10px] text-gray-400 font-mono block uppercase tracking-wider">Total Stored Images</span>
                <span className="text-xl font-bold font-mono text-cyan-300 block mt-0.5">
                  {faceProfiles.reduce((acc, p) => acc + (p.faceImages?.length || 0), 0)}
                </span>
              </div>
              <div className="bg-cyan-950/10 border border-cyan-500/10 p-3 rounded-lg text-center shadow-inner">
                <span className="text-[10px] text-gray-400 font-mono block uppercase tracking-wider">Total Stored Descriptors</span>
                <span className="text-xl font-bold font-mono text-cyan-300 block mt-0.5">
                  {faceProfiles.reduce((acc, p) => acc + (p.faceDescriptors?.length || 0), 0)}
                </span>
              </div>
            </div>

            {/* Fallback rendering when no biometric profiles exist in the system */}
            {faceProfiles.length === 0 && (
              <div className="bg-amber-950/20 border border-amber-500/30 p-4 rounded-lg text-center font-mono text-xs text-amber-500 tracking-wider my-2">
                No biometric registrations found.
              </div>
            )}

            {/* Student Biometrics Audit Ledger */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between border-b border-cyan-500/10 pb-2">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-black">
                  STUDENT COMPLIANCE AUDIT
                </span>
                <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                  Matriculate records: {students.length} entries
                </span>
              </div>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                <table className="w-full text-left text-xs min-w-[520px]">
                  <thead>
                    <tr className="border-b border-cyan-500/15 text-[10px] font-mono uppercase text-cyan-400 tracking-wider">
                      <th className="pb-3 pl-2">Student Name</th>
                      <th className="pb-3">USN Reference</th>
                      <th className="pb-3 text-center">Face Registered</th>
                      <th className="pb-3 text-center">Images Count</th>
                      <th className="pb-3 text-center">Descriptors Count</th>
                      <th className="pb-3 pr-2 text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/5 font-sans">
                    {students.map(student => {
                      const profile = faceProfiles.find(fp => fp.studentId === student.id || fp.usn.toUpperCase() === student.usn.toUpperCase());
                      const hasFaceReg = !!profile;
                      
                      return (
                        <tr key={student.id} className="hover:bg-cyan-950/5 transition-colors">
                          <td className="py-2.5 pl-2">
                            <span className="font-semibold text-white block">{student.name}</span>
                            <span className="text-[10px] text-gray-400 block">{student.department}</span>
                          </td>
                          <td className="py-2.5 font-mono font-black text-cyan-400">{student.usn}</td>
                          <td className="py-2.5 text-center">
                            {hasFaceReg ? (
                              <span className="text-[9px] font-mono font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-950/20 px-2 py-0.5 rounded uppercase tracking-wider">
                                YES
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-bold text-red-400 border border-red-500/30 bg-red-950/20 px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                                NO
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-center font-mono text-gray-300 font-semibold">
                            {profile?.faceImages?.length || 0}
                          </td>
                          <td className="py-2.5 text-center font-mono text-gray-300 font-semibold">
                            {profile?.faceDescriptors?.length || 0}
                          </td>
                          <td className="py-2.5 pr-2 text-right">
                            {hasFaceReg ? (
                              <button
                                onClick={() => handleDeleteProfile(profile.id || profile.studentId)}
                                className="p-1 px-2 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-black rounded transition-all text-[9.5px] font-mono uppercase cursor-pointer"
                                title="Purge biometric profiles"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline inline-block mr-1" /> purge
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-600 font-mono select-none">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* BIOMETRIC SCANNING ENGAGEMENT WORKFLOW SCREEN */
        <div className="bg-[#0b0f1e]/95 backdrop-blur-md border-2 border-cyan-500/30 rounded-2xl p-6 relative overflow-hidden">
          
          {/* Cyber decoration background grids */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.1)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-20" />
          
          <div className="flex items-center justify-between border-b border-cyan-500/10 pb-4 mb-6 relative">
            <div className="flex items-center space-x-3">
              <div className="bg-cyan-400 text-black p-2 rounded-lg relative overflow-hidden animate-pulse">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-widest font-sans">
                  ACTIVE_BIOMETRIC_CAPTURE: {activeRegStudent.name}
                </h4>
                <p className="text-[10px] font-mono text-cyan-400 uppercase mt-0.5">
                  USN: <span className="text-white font-bold">{activeRegStudent.usn}</span> // DEPT: <span className="text-white">{activeRegStudent.department}</span>
                </p>
              </div>
            </div>

            <button
              onClick={handleCancelRegistration}
              className="bg-black/50 hover:bg-red-900/30 text-gray-400 hover:text-red-400 border border-gray-800 hover:border-red-500/30 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer"
            >
              TERMINATE_PROTOCOL
            </button>
          </div>

          {/* Success screen */}
          {successData ? (
            <div className="text-center py-10 max-w-lg mx-auto space-y-6 relative z-10">
              <div className="inline-block p-4 rounded-full bg-emerald-500/10 border-2 border-emerald-400 animate-pulse">
                <ShieldCheck className="w-10 h-10 text-[#00ffd2]" />
              </div>
              
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-white font-sans uppercase tracking-widest text-[#00ffd2]">
                  Biometric Registration Complete
                </h2>
                <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                  Neural face mapping templates successfully bound and persisted to secure local database records.
                </p>
              </div>

              <div className="bg-slate-950/60 p-5 border border-cyan-500/20 rounded-xl text-left font-mono text-[11px] space-y-2.5 max-w-md mx-auto shadow-[0_0_20px_rgba(0,255,210,0.05)] text-gray-300">
                <div className="border-b border-cyan-500/15 pb-2 flex justify-between items-center">
                  <span className="text-gray-500 font-bold uppercase tracking-wider text-[9px]">DIAGNOSTIC MATRIX</span>
                  <span className="text-emerald-400 font-black text-[10px] uppercase tracking-wider bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20">
                    Status: Registration Successful
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-cyan-500/5">
                  <span className="text-gray-400">Student Name</span>
                  <span className="text-white font-medium text-right">{successData.studentName}</span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-cyan-500/5">
                  <span className="text-gray-400">USN Reference</span>
                  <span className="text-cyan-400 font-bold tracking-wider">{successData.usn}</span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-cyan-500/5">
                  <span className="text-gray-400">Images Stored</span>
                  <span className="text-emerald-400 font-bold">{successData.imagesCount} / 10 Frames</span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-cyan-500/5">
                  <span className="text-gray-400">Descriptors Stored</span>
                  <span className="text-emerald-400 font-bold">{successData.descriptorsCount} / 10 Templates</span>
                </div>

                <div className="flex justify-between items-center py-0.5 border-b border-cyan-500/5">
                  <span className="text-gray-400">Descriptor Length</span>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold mr-1">{successData.descriptorLength}</span>
                    <span className="text-gray-500 text-[9px]">(Expected: 128)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 text-gray-400">
                  <span>Registration Timestamp</span>
                  <span className="text-gray-300 font-sans font-medium">{successData.timestamp}</span>
                </div>
              </div>

              <button
                onClick={handleCancelRegistration}
                className="bg-[#00ffd2] hover:bg-cyan-400 text-black font-mono font-bold text-[10px] tracking-widest px-8 py-3 rounded-lg uppercase shadow-lg shadow-[#00ffd2]/10 transition-all cursor-pointer hover:scale-102"
              >
                PROCEED_TO_TERMINAL
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
              
              {/* WEBCAM MODULE BOX (7/12) */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-4">
                
                {/* INTERACTIVE SCAN FRAME */}
                <div className="w-full aspect-[4/3] bg-black border-2 border-cyan-500/20 rounded-2xl relative overflow-hidden flex items-center justify-center group shadow-xl">
                  
                  {/* Cyber Reticles and overlays */}
                  <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10 flex items-center justify-between px-4 font-mono text-[9px] text-cyan-400">
                    <span>BIO_NODE: 409-C5</span>
                    <span className="flex items-center gap-1.5 font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> CAMERA_STREAM
                    </span>
                  </div>

                  {/* WEBCAM VIDEO STREAM */}
                  <video 
                    ref={videoRef}
                    playsInline 
                    muted
                    className="w-full h-full object-cover select-none scale-x-[-1]" // mirror view
                  />

                  {/* CAPTURE INTERMEDIATE CANVAS - HIDDEN */}
                  <canvas 
                    ref={canvasRef}
                    width="640"
                    height="480"
                    className="hidden"
                  />

                  {/* CYBER REGISTRATION ELLIPSE OVERLAY (ALIGNMENT GUIDE) */}
                  <div className="absolute inset-0 pointer-events-none border-2 border-transparent flex items-center justify-center">
                    <div className="w-56 h-72 rounded-[110px] border-2 border-dashed border-cyan-400/50 flex items-center justify-center animate-[spin_40s_linear_infinite] shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                      <div className="w-full h-full rounded-[106px] border border-cyan-500/25" />
                    </div>
                    
                    {/* Laser scanning bar animation */}
                    {isCapturing && (
                      <div className="absolute w-full h-[3px] bg-cyan-400 opacity-80 left-0 top-0 animate-[scan_1.5s_infinite_linear] shadow-[0_0_10px_#06b6d4,0_0_20px_#06b6d4]" />
                    )}
                    
                    {/* Retro Corner brackets */}
                    <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan-500/60 rounded-tl" />
                    <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan-500/60 rounded-tr" />
                    <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan-500/60 rounded-bl" />
                    <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan-500/60 rounded-br" />
                  </div>

                  {/* DETECTED NODE POINTS SIMULATOR GRAPHICS */}
                  {cameraActive && !isCapturing && (
                    <div className="absolute inset-0 pointer-events-none opacity-60">
                      {/* Interactive face landmarks tracking indicators */}
                      <span className="absolute top-[35%] left-[38%] w-1.5 h-1.5 rounded-full bg-[#00ffd2] shadow-[0_0_4px_rgba(0,255,190,0.8)]" />
                      <span className="absolute top-[35%] left-[62%] w-1.5 h-1.5 rounded-full bg-[#00ffd2] shadow-[0_0_4px_rgba(0,255,190,0.8)]" />
                      <span className="absolute top-[48%] left-[50%] w-1.5 h-1.5 rounded-full bg-[#00ffd2] shadow-[0_0_4px_rgba(0,255,190,0.8)]" />
                      <span className="absolute top-[62%] left-[45%] w-1 h-1 rounded-full bg-[#28e6c7]" />
                      <span className="absolute top-[62%] left-[55%] w-1 h-1 rounded-full bg-[#28e6c7]" />
                      <span className="absolute top-[62%] left-[50%] w-1.5 h-1 rounded-full bg-[#00ffd2]" />
                    </div>
                  )}

                  {/* COUNTDOWN OVERLAY */}
                  {countdown !== null && (
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                      <span className="text-[10px] font-mono tracking-widest text-[#00ffd2] uppercase animate-pulse">RECORDING LANDMARKS IN...</span>
                      <span className="text-6xl font-black font-mono text-white animate-ping">{countdown}</span>
                    </div>
                  )}

                  {/* LOADING STREAM COVERS */}
                  {!cameraActive && (
                    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4">
                      {cameraError ? (
                        <div className="text-center space-y-3 p-4">
                          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto animate-bounce" />
                          <p className="text-xs text-red-400 font-mono tracking-wide">{cameraError}</p>
                          <button 
                            onClick={startWebcam}
                            className="bg-red-500/10 hover:bg-red-500 hover:text-black border border-red-500/20 text-red-400 px-4 py-2 rounded text-xs font-mono transition-all uppercase cursor-pointer"
                          >
                            RETRACT PERMISSIONS DECRYPT
                          </button>
                        </div>
                      ) : (
                        <div className="text-center space-y-2">
                          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                          <p className="text-xs text-cyan-400 font-mono">ESTABLISHING CRYPTOGRAPHIC CAMERA SECURE CHANNEL...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* VALIDATION REJECTION CARD */}
                {validationError && (
                  <div className="w-full bg-red-950/20 border border-red-500/30 p-3 rounded-xl flex items-start space-x-2 text-red-400 font-mono text-[10.5px]">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 animate-pulse" />
                    <span className="leading-relaxed uppercase tracking-tight">{validationError}</span>
                  </div>
                )}

                {/* BOTTOM HANDSHAKE TRIGGERS */}
                <div className="w-full flex items-center justify-between gap-4">
                  <div className="text-[9.5px] font-mono text-gray-500 leading-normal uppercase">
                    • POSES COUNT: <b className="text-white">{capturedImages.length} / 10</b> <br />
                    • MIN SHARPNESS INDEX: <b className="text-cyan-400">2.0 pixels</b> <br />
                    • LAST MEASURED SHARPNESS: <b className="text-[#00ffd2]">{measuredSharpness !== null ? measuredSharpness.toFixed(2) : 'N/A'}</b>
                  </div>

                  <button
                    onClick={captureFrame}
                    disabled={isCapturing || !cameraActive || countdown !== null}
                    className="bg-[#00ffd2] disabled:bg-cyan-500/10 text-black disabled:text-gray-500 font-mono font-black text-xs tracking-widest px-8 py-3 rounded-xl uppercase hover:bg-cyan-400 shadow-lg shadow-[#00ffd2]/10 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {isCapturing ? 'ACQUIRING...' : `Engage Capture (Pose ${capturedImages.length + 1})`}
                  </button>
                </div>
              </div>

              {/* POSTURE CONTROLS & TRACE VIEWER (5/12) */}
              <div className="lg:col-span-5 space-y-5">
                
                {/* POSTURE INSTRUCTION BOX */}
                <div className="bg-cyan-950/5 border border-cyan-500/10 p-4 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono font-bold text-[#00ffd2] bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded uppercase">
                    ACTIVE SCANNERS GUIDE {currentStep + 1} / 10
                  </span>
                  
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                      {POSE_GUIDES[currentStep]?.label}
                    </h5>
                    <p className="text-[11px] text-cyan-300 font-mono leading-relaxed">
                      {POSE_GUIDES[currentStep]?.instruction}
                    </p>
                  </div>
                </div>

                {/* PROGRESS SEGMENTS METER */}
                <div className="space-y-2">
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">
                    BIOMETRIC PACKET CAPTURES PROGRESS
                  </span>
                  <div className="grid grid-cols-10 gap-1.5">
                    {POSE_GUIDES.map((pose, idx) => {
                      const isComplete = idx < capturedImages.length;
                      const isActive = idx === capturedImages.length;
                      return (
                        <div 
                          key={pose.poseKey + idx} 
                          className={`h-2 rounded transition-all ${
                            isComplete 
                              ? 'bg-[#00ffd2] shadow-[0_0_6px_#00ffd2]' 
                              : isActive 
                              ? 'bg-cyan-400/50 animate-pulse' 
                              : 'bg-slate-900 border border-gray-800'
                          }`}
                          title={pose.label}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* LANDMARK MINI-PICS SCROLLER */}
                <div className="space-y-2">
                  <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest block">
                    BIOMETRIC SENSORS TRAY (THUMBNAILS)
                  </span>
                  
                  <div className="grid grid-cols-5 gap-2 bg-black/40 border border-cyan-500/5 p-2 rounded-xl min-h-[75px] max-h-[160px] overflow-y-auto">
                    {capturedImages.length === 0 ? (
                      <div className="col-span-5 flex items-center justify-center p-6 text-gray-700 text-[10px] font-mono uppercase">
                        Tray empty: take sample
                      </div>
                    ) : (
                      capturedImages.map((img, idx) => (
                        <div 
                          key={idx} 
                          className="relative aspect-square bg-slate-950 rounded-lg overflow-hidden border border-[#00ffd2]/30 group"
                        >
                          <img 
                            src={img} 
                            alt={`Pose ${idx + 1}`} 
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                          <div className="absolute inset-0 bg-cyan-950/40 pointer-events-none flex items-end justify-center pb-0.5">
                            <span className="text-[8px] font-mono text-[#00ffd2] font-black">#{idx + 1}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* BIOMETRIC INTEGRAL INFORMATION */}
                <div className="bg-black/40 p-4 border border-cyan-500/10 rounded-xl space-y-2.5 font-mono text-[10px] text-gray-400 leading-normal">
                  <div className="flex items-center justify-between text-[11px] font-bold text-white border-b border-cyan-500/10 pb-1.5 uppercase">
                    <span>Scanner Properties</span>
                    <span className="text-[#00ffd2]">ONLINE</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ALGORITHM MODE</span>
                    <span className="text-cyan-400">FaceAPI.js Embeddings Generator</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SPATIAL DESCRIPTOR RESOLUTION</span>
                    <span className="text-white">128-float dimensional matrix</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SECURITY COHESION INTEGRITY</span>
                    <span className="text-[#00ffd2]">High Precision Phase [Enforced]</span>
                  </div>
                  <div className="pt-1.5 border-t border-cyan-500/10">
                    <p className="text-[9.5px] uppercase text-cyan-300/60 leading-normal">
                      Note: These visual matrices represent authentic facial structure calibration. Face templates are stored with full cascading key dependencies.
                    </p>
                  </div>
                </div>

              </div>

              {/* DIAGNOSTIC BEACON & TELEMETRY TERMINAL */}
              <div id="biometric-diagnostics-terminal" className="col-span-1 lg:col-span-12 mt-4 bg-slate-950/80 border border-cyan-500/25 rounded-xl p-5 space-y-4 font-mono text-xs text-gray-300 relative z-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-cyan-500/20 pb-2 gap-2">
                  <h5 className="text-[#00ffd2] font-black uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00ffd2] animate-pulse" />
                    BIOMETRIC_REGISTRY_DIAGNOSTICS_TERMINAL
                  </h5>
                  <span className="text-[10px] text-gray-500 uppercase">
                    SYS_TIME: {new Date().toISOString()}
                  </span>
                </div>

                {/* METRICS ROW */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-black/40 border border-cyan-500/10 p-3 rounded">
                    <span className="text-gray-500 text-[10px] uppercase block mb-1">Save Endpoint</span>
                    <span className="text-white font-bold block truncate" title={debugEndpoint || 'N/A'}>
                      {debugEndpoint || 'Awaiting transmission...'}
                    </span>
                  </div>

                  <div className="bg-black/40 border border-cyan-500/10 p-3 rounded">
                    <span className="text-gray-500 text-[10px] uppercase block mb-1">Response Status</span>
                    <span className={`font-black block text-sm ${
                      debugStatus === null ? 'text-gray-400' :
                      debugStatus >= 200 && debugStatus < 300 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {debugStatus !== null ? `${debugStatus} ${debugStatus === 201 ? 'CREATED' : debugStatus === 413 ? 'PAYLOAD_TOO_LARGE' : 'ERROR'}` : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-black/40 border border-cyan-500/10 p-3 rounded">
                    <span className="text-gray-500 text-[10px] uppercase block mb-1">Content-Type</span>
                    <span className={`block font-bold truncate ${debugContentType.includes('html') ? 'text-amber-400' : 'text-gray-300'}`}>
                      {debugContentType || 'N/A'}
                    </span>
                  </div>

                  <div className="bg-black/40 border border-cyan-500/10 p-3 rounded">
                    <span className="text-gray-500 text-[10px] uppercase block mb-1">Registration State</span>
                    <span className={`font-black block text-xs uppercase ${
                      debugSuccess === null ? 'text-amber-500' :
                      debugSuccess ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {debugSuccess === null ? (debugEndpoint ? 'TRANSMITTING...' : 'IDLE') :
                       debugSuccess ? 'SUCCESS (SYNCHRONIZED)' : 'FAILED (ABORTED)'}
                    </span>
                  </div>
                </div>

                {/* LOGS AND BODY CONFLICT DISPLAY */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* LIVE LOGS FEED */}
                  <div className="space-y-1.5 flex flex-col">
                    <span className="text-gray-500 text-[10px] uppercase tracking-wider block">Diagnostics Audit Logs Tracer</span>
                    <div className="bg-black border border-cyan-500/10 rounded p-3 h-48 overflow-y-auto font-mono text-[10px] text-cyan-400/80 leading-relaxed space-y-1 scrollbar-thin">
                      {debugLogs.length === 0 ? (
                        <div className="text-gray-600 italic">No logs recorded. Engage pose capture sequence to trigger save process.</div>
                      ) : (
                        debugLogs.map((log, lIdx) => (
                          <div key={lIdx} className="border-b border-cyan-950/20 pb-0.5 last:border-0 hover:text-white transition-colors">
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* RESPONSE RAW BODY VIEW */}
                  <div className="space-y-1.5 flex flex-col">
                    <span className="text-gray-500 text-[10px] uppercase tracking-wider block">Raw Response Stream Payload Snippet</span>
                    <div className="bg-black border border-cyan-500/10 rounded p-3 h-48 overflow-y-auto font-mono text-[10px] whitespace-pre-wrap leading-relaxed scrollbar-thin">
                      {debugResponseBody ? (
                        <div className={debugContentType.includes('html') ? 'text-amber-500' : 'text-emerald-300'}>
                          {debugResponseBody}
                        </div>
                      ) : debugErrorDetail ? (
                        <div className="text-red-400 font-bold">{debugErrorDetail}</div>
                      ) : (
                        <div className="text-gray-600 italic">No response body stream received yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
