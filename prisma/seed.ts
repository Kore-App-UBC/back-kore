import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Hash passwords
  // Delete in order to avoid foreign key constraints
  await prisma.report.deleteMany();
  await prisma.videoSubmission.deleteMany();
  await prisma.prescribedExercise.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.physiotherapistProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.clinic.deleteMany();
  await prisma.exercise.deleteMany();

  const hashedPassword = await bcrypt.hash('password', 10);

  // Create clinic
  const clinic = await prisma.clinic.create({
    data: {
      name: 'Example Clinic',
    },
  });

  // Create users with different roles
  const patient = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'patient@example.com',
      password: hashedPassword,
      role: 'PATIENT',
    },
  });

  const physiotherapist = await prisma.user.create({
    data: {
      name: 'Jane Smith',
      email: 'physio@example.com',
      password: hashedPassword,
      role: 'PHYSIOTHERAPIST',
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Bob Johnson',
      email: 'manager@example.com',
      password: hashedPassword,
      role: 'MANAGER',
      clinicId: clinic.id,
    },
  });

  // Create exercises based on pose_evaluation.py
  const exercises = [
    {
      name: 'Bicep Curls',
      description: 'Perform bicep curls by curling your arms from extended to flexed position.',
      instructionsUrl: 'https://example.com/bicep-curls',
      classificationData: {
        thresholds: {
          up: 160,
          down: 40,
        },
        landmarks: ['RIGHT_SHOULDER', 'RIGHT_ELBOW', 'RIGHT_WRIST'],
        evaluationType: 'low_to_high',
      },
      animationData: {
        basePoints: {
          'head': [0, -95, 0],
          'neck': [0, -80, 0],
          'mid_hip': [0, 0, 0],
          'left_shoulder': [-30, -70, 0],
          'right_shoulder': [30, -70, 0],
          'left_hip': [-20, 0, 0],
          'right_hip': [20, 0, 0],
          'left_elbow': [-30, -30, 0],
          'right_elbow': [30, -30, 0],
          'left_wrist': [-30, 10, 0],
          'right_wrist': [30, 10, 0],
          'left_knee': [-20, 50, 0],
          'right_knee': [20, 50, 0],
          'left_ankle': [-20, 100, 0],
          'right_ankle': [20, 100, 0],
        },
        keyframes: [
          {
            progress: 0.0, // Start position
            transformations: [
              {
                joint: 'right_elbow',
                type: 'relative_translate',
                offset: [0, 40, 10],
                relativeTo: 'right_shoulder'
              },
              {
                joint: 'right_wrist',
                type: 'relative_translate',
                offset: [0, 40, 0],
                relativeTo: 'right_elbow'
              }
            ]
          },
          {
            progress: 0.5, // Mid curl
            transformations: [
              {
                joint: 'right_elbow',
                type: 'relative_translate',
                offset: [0, 40, 10],
                relativeTo: 'right_shoulder'
              },
              {
                joint: 'right_wrist',
                type: 'rotate_around_joint',
                pivotJoint: 'right_elbow',
                axis: 'x',
                angle: -80, // 80 degrees curl
                distance: 40
              }
            ]
          },
          {
            progress: 1.0, // Full curl
            transformations: [
              {
                joint: 'right_elbow',
                type: 'relative_translate',
                offset: [0, 40, 10],
                relativeTo: 'right_shoulder'
              },
              {
                joint: 'right_wrist',
                type: 'rotate_around_joint',
                pivotJoint: 'right_elbow',
                axis: 'x',
                angle: -160, // Full 160 degree curl
                distance: 40
              }
            ]
          }
        ],
        animationType: 'oscillating' // Smooth back and forth motion
      },
    },
    {
      name: 'Shoulder Abduction',
      description: 'Raise your arms out to the sides away from your body.',
      instructionsUrl: 'https://example.com/shoulder-abduction',
      classificationData: {
        thresholds: {
          up: 70,
          down: 30,
        },
        landmarks: ['RIGHT_HIP', 'RIGHT_SHOULDER', 'RIGHT_ELBOW'],
        evaluationType: 'high_to_low',
      },
      animationData: {
        basePoints: {
          'head': [0, -95, 0],
          'neck': [0, -80, 0],
          'mid_hip': [0, 0, 0],
          'left_shoulder': [-30, -70, 0],
          'right_shoulder': [30, -70, 0],
          'left_hip': [-20, 0, 0],
          'right_hip': [20, 0, 0],
          'left_elbow': [-30, -30, 0],
          'right_elbow': [30, -30, 0],
          'left_wrist': [-30, 10, 0],
          'right_wrist': [30, 10, 0],
          'left_knee': [-20, 50, 0],
          'right_knee': [20, 50, 0],
          'left_ankle': [-20, 100, 0],
          'right_ankle': [20, 100, 0],
        },
        keyframes: [
          {
            progress: 0.0,
            transformations: [
              {
                joint: 'right_elbow',
                type: 'rotate_around_joint',
                pivotJoint: 'right_shoulder',
                axis: 'x',
                angle: 0,
                distance: 40
              },
              {
                joint: 'right_wrist',
                type: 'rotate_around_joint',
                pivotJoint: 'right_shoulder',
                axis: 'x',
                angle: 0,
                distance: 80
              }
            ]
          },
          {
            progress: 0.5,
            transformations: [
              {
                joint: 'right_elbow',
                type: 'rotate_around_joint',
                pivotJoint: 'right_shoulder',
                axis: 'x',
                angle: -35,
                distance: 40
              },
              {
                joint: 'right_wrist',
                type: 'rotate_around_joint',
                pivotJoint: 'right_shoulder',
                axis: 'x',
                angle: -35,
                distance: 80
              }
            ]
          },
          {
            progress: 1.0,
            transformations: [
              {
                joint: 'right_elbow',
                type: 'rotate_around_joint',
                pivotJoint: 'right_shoulder',
                axis: 'x',
                angle: -70,
                distance: 40
              },
              {
                joint: 'right_wrist',
                type: 'rotate_around_joint',
                pivotJoint: 'right_shoulder',
                axis: 'x',
                angle: -70,
                distance: 80
              }
            ]
          }
        ]
      },
    },
    {
      name: 'Lateral Leg Raise',
      description: 'Raise your leg out to the side while standing.',
      instructionsUrl: 'https://example.com/lateral-leg-raise',
      classificationData: {
        thresholds: {
          up: 150,
          down: 130,
        },
        landmarks: ['RIGHT_SHOULDER', 'RIGHT_HIP', 'RIGHT_KNEE'],
        evaluationType: 'high_to_low',
      },
      animationData: {
        basePoints: {
          'head': [0, -95, 0],
          'neck': [0, -80, 0],
          'mid_hip': [0, 0, 0],
          'left_shoulder': [-30, -70, 0],
          'right_shoulder': [30, -70, 0],
          'left_hip': [-20, 0, 0],
          'right_hip': [20, 0, 0],
          'left_elbow': [-30, -30, 0],
          'right_elbow': [30, -30, 0],
          'left_wrist': [-30, 10, 0],
          'right_wrist': [30, 10, 0],
          'left_knee': [-20, 50, 0],
          'right_knee': [20, 50, 0],
          'left_ankle': [-20, 100, 0],
          'right_ankle': [20, 100, 0],
        },
        keyframes: [
          {
            progress: 0.0,
            transformations: [
              {
                joint: 'right_knee',
                type: 'relative_translate',
                offset: [0, 50, 0],
                relativeTo: 'right_hip'
              },
              {
                joint: 'right_ankle',
                type: 'relative_translate',
                offset: [0, 100, 0],
                relativeTo: 'right_hip'
              }
            ]
          },
          {
            progress: 0.5,
            transformations: [
              {
                joint: 'right_knee',
                type: 'rotate_around_joint',
                pivotJoint: 'right_hip',
                axis: 'z',
                angle: -22.5,
                distance: 50
              },
              {
                joint: 'right_ankle',
                type: 'rotate_around_joint',
                pivotJoint: 'right_hip',
                axis: 'z',
                angle: -22.5,
                distance: 100
              }
            ]
          },
          {
            progress: 1.0,
            transformations: [
              {
                joint: 'right_knee',
                type: 'rotate_around_joint',
                pivotJoint: 'right_hip',
                axis: 'z',
                angle: -45,
                distance: 50
              },
              {
                joint: 'right_ankle',
                type: 'rotate_around_joint',
                pivotJoint: 'right_hip',
                axis: 'z',
                angle: -45,
                distance: 100
              }
            ]
          }
        ]
      },
    },
    {
      name: 'Knee Extension',
      description: 'Extend your leg from a seated position.',
      instructionsUrl: 'https://example.com/knee-extension',
      classificationData: {
        thresholds: {
          up: 160,
          down: 90,
        },
        landmarks: ['RIGHT_HIP', 'RIGHT_KNEE', 'RIGHT_ANKLE'],
        evaluationType: 'high_to_low',
      },
      animationData: {
        keyframes: [
          {
            progress: 0,
            transformations: [
              {
                type: "relative_translate",
                joint: "right_knee",
                offset: [
                  0,
                  50,
                  20
                ],
                relativeTo: "right_hip"
              },
              {
                axis: "x",
                type: "rotate_around_joint",
                angle: 30,
                joint: "right_ankle",
                distance: 50,
                pivotJoint: "right_knee"
              }
            ]
          },
          {
            progress: 0.5,
            transformations: [
              {
                type: "relative_translate",
                joint: "right_knee",
                offset: [
                  0,
                  50,
                  20
                ],
                relativeTo: "right_hip"
              },
              {
                axis: "x",
                type: "rotate_around_joint",
                angle: 70,
                joint: "right_ankle",
                distance: 50,
                pivotJoint: "right_knee"
              }
            ]
          },
          {
            progress: 1,
            transformations: [
              {
                type: "relative_translate",
                joint: "right_knee",
                offset: [
                  0,
                  50,
                  20
                ],
                relativeTo: "right_hip"
              },
              {
                axis: "x",
                type: "rotate_around_joint",
                angle: 140,
                joint: "right_ankle",
                distance: 50,
                pivotJoint: "right_knee"
              }
            ]
          }
        ],
        basePoints: {
          'head': [
            0,
            -95,
            0
          ],
          'neck': [
            0,
            -80,
            0
          ],
          'mid_hip': [
            0,
            0,
            0
          ],
          'left_hip': [
            -20,
            0,
            0
          ],
          'left_knee': [
            -20,
            50,
            -20
          ],
          'right_hip': [
            20,
            0,
            0
          ],
          'left_ankle': [
            -20,
            100,
            0
          ],
          'left_elbow': [
            -30,
            -30,
            0
          ],
          'left_wrist': [
            -30,
            10,
            0
          ],
          'right_knee': [
            20,
            50,
            0
          ],
          'right_ankle': [
            0,
            0,
            0
          ],
          'right_elbow': [
            30,
            -30,
            0
          ],
          'right_wrist': [
            30,
            10,
            0
          ],
          'left_shoulder': [
            -30,
            -70,
            0
          ],
          'right_shoulder': [
            30,
            -70,
            0
          ]
        }
      },
    },
  ];

  for (const exerciseData of exercises) {
    await prisma.exercise.create({
      data: exerciseData,
    });
  }

  console.log('Clinic, users, and exercises created:', { clinic, patient, physiotherapist, manager, exercisesCount: exercises.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });