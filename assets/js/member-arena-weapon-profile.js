// Measured IntroFighters 3.2 resource/configuration profile (static package + mapped native evidence).
// Coordinates are Unity world units, Y up. Sprite PNGs retain their full rect and centered pivot.
// bodyDiameter=1.12 is the site's chosen common RSI-avatar reference, NOT an original fixed avatar size.
// Null fields do not exist on that source type; SI_Fist uses the separate hand controller.
// Animations retain original serialized speed/delay/points fields; values are seconds/Unity units.
// Held-item and projectile stats are deliberately separate; a magic hand is not a gun sprite.
(() => {
  "use strict";
  const profile = {
  "sourceHash": "0d943e7e9d5194f5ed994f97ca121438a8cc41ea1639a6743505ee222fe56c1c",
  "coordinateSystem": "Unity x-right y-up",
  "bodyDiameter": 1.12,
  "hand": {
    "sprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
    "fistSprite": "./assets/arena/original-fist-02-6bd7dc68acd8.webp",
    "openSprite": "./assets/arena/original-grab-01-8cf3c587105d.webp",
    "width": 0.5688888888888889,
    "height": 0.5688888888888889,
    "openWidth": 0.6826666666666666,
    "openHeight": 0.6826666666666666,
    "rotationPid": {
      "Kp": 10.0,
      "Ki": 0.0,
      "Kd": 1.0
    },
    "sliderPid": {
      "Kp": 32.5,
      "Ki": 0.0,
      "Kd": 0.10000000149011612
    },
    "length": 1.2000000476837158,
    "maxForce": 5000.0,
    "rotationMaxErrorDegrees": 50,
    "bodyMass": 40,
    "physicsMass": 1,
    "armMass": 1,
    "idlePosition": {
      "x": 0.4000000059604645,
      "y": 0.0
    },
    "fistRadius": 0.20000000298023224,
    "fistMass": 1.0,
    "pickupCastRadius": 0.3499999940395355
  },
  "weapons": {
    "fists": {
      "name": "拳头",
      "sprite": "./assets/arena/original-fist-02-6bd7dc68acd8.webp",
      "width": 0.5688888888888889,
      "height": 0.5688888888888889,
      "anchor": {
        "x": 0,
        "y": 0
      },
      "handPosition": {
        "x": 0.0,
        "y": 0.0
      },
      "handSprite": "./assets/arena/original-fist-02-6bd7dc68acd8.webp",
      "handRotation": 0.4363322690521652,
      "forwardAngle": null,
      "holdAngle": null,
      "invertX": null,
      "invertY": null,
      "pid": null,
      "angleErrorClamp": null,
      "mass": 1.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 10.0,
        "maxDamage": 30.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 0.800000011920929,
        "itemReach": 1.0
      },
      "colliders": [
        {
          "type": "circle",
          "center": {
            "x": 0.0,
            "y": 0.0
          },
          "radius": 0.20000000298023224
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.75,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": null,
      "ammo": null,
      "canBeThrown": true,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": []
    },
    "shortsword": {
      "name": "短剑",
      "sprite": "./assets/arena/original-shortsword-d8a376eae9df.webp",
      "width": 0.5270833626555088,
      "height": 2.0444444363205516,
      "anchor": {
        "x": 0.0,
        "y": -0.699999988079071
      },
      "handPosition": {
        "x": 0.0,
        "y": -0.699999988079071
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.17453299891476076,
      "forwardAngle": -90.0,
      "holdAngle": 0.0,
      "invertX": true,
      "invertY": false,
      "pid": {
        "Kp": 6.0,
        "Ki": 0.0,
        "Kd": 1.0
      },
      "angleErrorClamp": 30.0,
      "mass": 3.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 20.0,
        "maxDamage": 35.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 1.0,
        "itemReach": 2.0
      },
      "colliders": [
        {
          "type": "polygon",
          "points": [
            {
              "x": 0.07837128639221191,
              "y": -0.38839805126190186
            },
            {
              "x": 0.08123970031738281,
              "y": 0.6667740345001221
            },
            {
              "x": -0.0002390146255493164,
              "y": 1.0222243070602417
            },
            {
              "x": -0.07478749752044678,
              "y": 0.6772089004516602
            },
            {
              "x": -0.07550108432769775,
              "y": -0.38556182384490967
            },
            {
              "x": -0.2638176679611206,
              "y": -0.404427170753479
            },
            {
              "x": -0.06730592250823975,
              "y": -0.4759976863861084
            },
            {
              "x": -0.06403900682926178,
              "y": -0.9953519105911255
            },
            {
              "x": 0.05836482346057892,
              "y": -0.995352029800415
            },
            {
              "x": 0.06107914447784424,
              "y": -0.4758411645889282
            },
            {
              "x": 0.25932031869888306,
              "y": -0.40606796741485596
            }
          ]
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": true,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.800000011920929,
                  0.0
                ],
                [
                  -0.75,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.03999999910593033,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        },
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.75,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.5,
                  0.8999999761581421,
                  0.0
                ],
                [
                  1.899999976158142,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        0.0,
        0.0
      ],
      "ammo": null,
      "canBeThrown": true,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": []
    },
    "sword": {
      "name": "长剑",
      "sprite": "./assets/arena/original-sword-dc095e71cca5.webp",
      "width": 0.7,
      "height": 2.8444442749023438,
      "anchor": {
        "x": 0.0,
        "y": -0.949999988079071
      },
      "handPosition": {
        "x": 0.0,
        "y": -0.949999988079071
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.17453299891476076,
      "forwardAngle": -90.0,
      "holdAngle": 0.0,
      "invertX": true,
      "invertY": false,
      "pid": {
        "Kp": 12.5,
        "Ki": 0.0,
        "Kd": 1.0
      },
      "angleErrorClamp": 30.0,
      "mass": 3.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 20.0,
        "maxDamage": 50.0,
        "damageMultiplier": 1.25,
        "velocityMultiplier": 1.100000023841858,
        "itemReach": 3.0
      },
      "colliders": [
        {
          "type": "polygon",
          "points": [
            {
              "x": 0.07270669937133789,
              "y": -0.5793833136558533
            },
            {
              "x": 0.048101186752319336,
              "y": 1.2192261219024658
            },
            {
              "x": -0.0016120672225952148,
              "y": 1.426862120628357
            },
            {
              "x": -0.044831156730651855,
              "y": 1.2122557163238525
            },
            {
              "x": -0.07183229923248291,
              "y": -0.5724424719810486
            },
            {
              "x": -0.3411980867385864,
              "y": -0.5996217131614685
            },
            {
              "x": -0.0761193037033081,
              "y": -0.7296955585479736
            },
            {
              "x": -0.1008450984954834,
              "y": -1.3826814889907837
            },
            {
              "x": 0.09719105064868927,
              "y": -1.384110450744629
            },
            {
              "x": 0.07723033428192139,
              "y": -0.730516254901886
            },
            {
              "x": 0.3323851227760315,
              "y": -0.6030197739601135
            }
          ]
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": true,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.800000011920929,
                  0.0
                ],
                [
                  -0.75,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.03999999910593033,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        },
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.75,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.5,
                  0.8999999761581421,
                  0.0
                ],
                [
                  1.899999976158142,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        0.0,
        0.0
      ],
      "ammo": null,
      "canBeThrown": true,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": []
    },
    "special": {
      "name": "特殊剑",
      "sprite": "./assets/arena/original-specialsword-670ddbe427b2.webp",
      "width": 0.510000012530311,
      "height": 2.2128814103010104,
      "anchor": {
        "x": 0.0,
        "y": -0.7139999866485596
      },
      "handPosition": {
        "x": 0.0,
        "y": -0.7139999866485596
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.17453299891476076,
      "forwardAngle": -90.0,
      "holdAngle": 0.0,
      "invertX": true,
      "invertY": false,
      "pid": {
        "Kp": 6.0,
        "Ki": 0.0,
        "Kd": 1.0
      },
      "angleErrorClamp": 30.0,
      "mass": 2.5,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 20.0,
        "maxDamage": 30.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 1.0,
        "itemReach": 2.0
      },
      "colliders": [
        {
          "type": "polygon",
          "points": [
            {
              "x": 0.08138441294431686,
              "y": -0.36677926778793335
            },
            {
              "x": 0.08772408962249756,
              "y": 0.8527138829231262
            },
            {
              "x": 0.001689821481704712,
              "y": 1.1693131923675537
            },
            {
              "x": -0.08115217834711075,
              "y": 0.858951210975647
            },
            {
              "x": -0.0901469886302948,
              "y": -0.36431387066841125
            },
            {
              "x": -0.25819265842437744,
              "y": -0.4341294765472412
            },
            {
              "x": -0.08479700982570648,
              "y": -0.4982750117778778
            },
            {
              "x": -0.08956733345985413,
              "y": -1.0894596576690674
            },
            {
              "x": 0.09155216813087463,
              "y": -1.0908886194229126
            },
            {
              "x": 0.08179790526628494,
              "y": -0.49996286630630493
            },
            {
              "x": 0.25522759556770325,
              "y": -0.43162786960601807
            }
          ]
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": true,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.800000011920929,
                  0.0
                ],
                [
                  -0.75,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.03999999910593033,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        },
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.75,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.5,
                  0.8999999761581421,
                  0.0
                ],
                [
                  1.899999976158142,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        0.0,
        0.0
      ],
      "ammo": null,
      "canBeThrown": true,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": [
        {
          "sprite": "./assets/arena/original-specialsword-670ddbe427b2.webp",
          "weight": 100
        },
        {
          "sprite": "./assets/arena/original-specialsword2-17da99be65bc.webp",
          "weight": 100
        },
        {
          "sprite": "./assets/arena/original-specialsword3-8c5bbf787532.webp",
          "weight": 500
        }
      ]
    },
    "spear": {
      "name": "长枪",
      "sprite": "./assets/arena/original-spear-44fa109a2ce7.webp",
      "width": 0.19335940054734413,
      "height": 3.300000029504301,
      "anchor": {
        "x": 0.0,
        "y": -1.0
      },
      "handPosition": {
        "x": 0.0,
        "y": -1.0
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.34906581023108146,
      "forwardAngle": -90.0,
      "holdAngle": 0.0,
      "invertX": true,
      "invertY": false,
      "pid": {
        "Kp": 9.0,
        "Ki": 0.0,
        "Kd": 2.5
      },
      "angleErrorClamp": 75.0,
      "mass": 3.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 21.0,
        "maxDamage": 37.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 1.2000000476837158,
        "itemReach": 4.0
      },
      "colliders": [
        {
          "type": "polygon",
          "points": [
            {
              "x": 0.0005270764231681824,
              "y": 1.64314603805542
            },
            {
              "x": -0.11077302694320679,
              "y": 1.1108065843582153
            },
            {
              "x": -0.07909940183162689,
              "y": -1.638691782951355
            },
            {
              "x": 0.07280649989843369,
              "y": -1.6388263702392578
            },
            {
              "x": 0.0950000137090683,
              "y": -0.25333335995674133
            },
            {
              "x": 0.10401313006877899,
              "y": 1.1153736114501953
            }
          ]
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": true,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.30000001192092896,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.800000011920929,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.03999999910593033,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.5,
                  1.5,
                  0.0
                ],
                [
                  2.0,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": true,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        0.0,
        0.0
      ],
      "ammo": null,
      "canBeThrown": true,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": [
        {
          "sprite": "./assets/arena/original-spear-44fa109a2ce7.webp",
          "weight": 100
        },
        {
          "sprite": "./assets/arena/original-spearshiny-17c3033c078e.webp",
          "weight": 10
        }
      ]
    },
    "pitchfork": {
      "name": "三齿叉",
      "sprite": "./assets/arena/original-pitchfork-667484768b9f.webp",
      "width": 0.5005468532205103,
      "height": 2.9799998703360613,
      "anchor": {
        "x": 0.0,
        "y": -0.800000011920929
      },
      "handPosition": {
        "x": 0.0,
        "y": -0.800000011920929
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.34906581023108146,
      "forwardAngle": -90.0,
      "holdAngle": 0.0,
      "invertX": true,
      "invertY": false,
      "pid": {
        "Kp": 10.0,
        "Ki": 0.0,
        "Kd": 2.0
      },
      "angleErrorClamp": 30.0,
      "mass": 3.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 18.0,
        "maxDamage": 33.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 1.0,
        "itemReach": 3.0
      },
      "colliders": [
        {
          "type": "polygon",
          "points": [
            {
              "x": -0.2530933618545532,
              "y": 1.460031509399414
            },
            {
              "x": -0.21660852432250977,
              "y": 0.8690534234046936
            },
            {
              "x": -0.05568109080195427,
              "y": 0.8525901436805725
            },
            {
              "x": -0.05176911875605583,
              "y": -1.4792160987854004
            },
            {
              "x": 0.053031355142593384,
              "y": -1.4798542261123657
            },
            {
              "x": 0.052400365471839905,
              "y": 0.8522398471832275
            },
            {
              "x": 0.21455389261245728,
              "y": 0.8709040284156799
            },
            {
              "x": 0.24702028930187225,
              "y": 1.4605939388275146
            }
          ]
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": true,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.30000001192092896,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.800000011920929,
                  0.0
                ],
                [
                  -0.75,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.03999999910593033,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": true,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        0.0,
        0.0
      ],
      "ammo": null,
      "canBeThrown": true,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": []
    },
    "axe": {
      "name": "战斧",
      "sprite": "./assets/arena/original-axe-35dc90f25fd4.webp",
      "width": 0.5422222063004133,
      "height": 1.4310193457654798,
      "anchor": {
        "x": -0.10000000149011612,
        "y": -0.44999998807907104
      },
      "handPosition": {
        "x": -0.10000000149011612,
        "y": -0.44999998807907104
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.17453299891476076,
      "forwardAngle": -90.0,
      "holdAngle": 0.0,
      "invertX": true,
      "invertY": false,
      "pid": {
        "Kp": 5.0,
        "Ki": 0.0,
        "Kd": 1.0
      },
      "angleErrorClamp": 30.0,
      "mass": 3.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 7.5,
        "minDamage": 10.0,
        "maxDamage": 35.0,
        "damageMultiplier": 2.0,
        "velocityMultiplier": 1.0,
        "itemReach": 2.0
      },
      "colliders": [
        {
          "type": "polygon",
          "points": [
            {
              "x": -0.008888889104127884,
              "y": -0.4555555582046509
            },
            {
              "x": -0.014068638905882835,
              "y": 0.4829443097114563
            },
            {
              "x": 0.19111111760139465,
              "y": 0.3844444453716278
            },
            {
              "x": 0.25198572874069214,
              "y": 0.5191826820373535
            },
            {
              "x": 0.2667241096496582,
              "y": 0.7133333683013916
            },
            {
              "x": -0.26767945289611816,
              "y": 0.663276731967926
            },
            {
              "x": -0.18666666746139526,
              "y": 0.1088888943195343
            },
            {
              "x": -0.16324517130851746,
              "y": -0.6822222471237183
            },
            {
              "x": -0.02222222276031971,
              "y": -0.7133333683013916
            },
            {
              "x": 0.0315343514084816,
              "y": -0.6197180151939392
            }
          ]
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 1.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.75,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  0.0,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        0.0,
        0.0
      ],
      "ammo": null,
      "canBeThrown": true,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": [
        {
          "sprite": "./assets/arena/original-axe-35dc90f25fd4.webp",
          "weight": 100
        },
        {
          "sprite": "./assets/arena/original-axeshiny-c4119b8530e8.webp",
          "weight": 15
        }
      ]
    },
    "mace": {
      "name": "钉头锤",
      "sprite": "./assets/arena/original-morningstar-7979c43502f3.webp",
      "width": 0.5699999754505783,
      "height": 2.3535482857314203,
      "anchor": {
        "x": 0.0,
        "y": -0.824999988079071
      },
      "handPosition": {
        "x": 0.0,
        "y": -0.824999988079071
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.17453299891476076,
      "forwardAngle": -90.0,
      "holdAngle": 0.0,
      "invertX": true,
      "invertY": false,
      "pid": {
        "Kp": 9.0,
        "Ki": 0.0,
        "Kd": 2.0
      },
      "angleErrorClamp": 30.0,
      "mass": 3.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 15.0,
        "maxDamage": 50.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 1.149999976158142,
        "itemReach": 3.0
      },
      "colliders": [
        {
          "type": "polygon",
          "points": [
            {
              "x": 0.05354975908994675,
              "y": 0.6268880367279053
            },
            {
              "x": 0.2018551379442215,
              "y": 0.6567335724830627
            },
            {
              "x": 0.2702656686306,
              "y": 0.8074941039085388
            },
            {
              "x": 0.2152489423751831,
              "y": 1.0654525756835938
            },
            {
              "x": 2.748984843492508e-05,
              "y": 1.1839067935943604
            },
            {
              "x": -0.22028090059757233,
              "y": 1.0550693273544312
            },
            {
              "x": -0.28353559970855713,
              "y": 0.8050121665000916
            },
            {
              "x": -0.20099890232086182,
              "y": 0.6581117510795593
            },
            {
              "x": -0.06158717721700668,
              "y": 0.6224046349525452
            },
            {
              "x": -0.0684361457824707,
              "y": -1.2763633728027344
            },
            {
              "x": 0.06862209737300873,
              "y": -1.2763116359710693
            }
          ]
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.4000000059604645,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.75,
                  1.25,
                  0.0
                ],
                [
                  1.75,
                  -0.75,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        0.0,
        0.0
      ],
      "ammo": null,
      "canBeThrown": true,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": [
        {
          "sprite": "./assets/arena/original-morningstar-7979c43502f3.webp",
          "weight": 100
        },
        {
          "sprite": "./assets/arena/original-morningstar2-ff665b7ddc37.webp",
          "weight": 20
        }
      ]
    },
    "bow": {
      "name": "弓",
      "sprite": "./assets/arena/original-shortbow-81fe93c26ec6.webp",
      "width": 0.45554687299402447,
      "height": 2.379999804234521,
      "anchor": {
        "x": 0.11999999731779099,
        "y": 0.0
      },
      "handPosition": {
        "x": 0.07500000298023224,
        "y": -0.15000000596046448
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.0,
      "forwardAngle": 0.0,
      "holdAngle": 0.0,
      "invertX": false,
      "invertY": true,
      "pid": {
        "Kp": 1.0,
        "Ki": 0.0,
        "Kd": 0.10000000149011612
      },
      "angleErrorClamp": 30.0,
      "mass": 3.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": false,
        "minDamageVelocity": 10.0,
        "minDamage": 10.0,
        "maxDamage": 35.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 0.5,
        "itemReach": 30.0
      },
      "colliders": [
        {
          "type": "polygon",
          "points": [
            {
              "x": 0.20917966961860657,
              "y": 0.5578124523162842
            },
            {
              "x": -0.20835185050964355,
              "y": 1.2029474973678589
            },
            {
              "x": 0.08137239515781403,
              "y": 0.5436745285987854
            },
            {
              "x": 0.07449999451637268,
              "y": -0.5762990117073059
            },
            {
              "x": -0.22777342796325684,
              "y": -1.1899999380111694
            },
            {
              "x": 0.19988280534744263,
              "y": -0.6321874856948853
            }
          ]
        },
        {
          "type": "polygon",
          "points": [
            {
              "x": 0.019999995827674866,
              "y": -0.30000001192092896
            },
            {
              "x": 0.2199999988079071,
              "y": -0.30000001192092896
            },
            {
              "x": 0.2199999988079071,
              "y": 0.30000001192092896
            },
            {
              "x": 0.019999995827674866,
              "y": 0.30000001192092896
            }
          ]
        }
      ],
      "animations": [],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        0.0,
        0.0
      ],
      "ammo": null,
      "canBeThrown": false,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": []
    },
    "magic": {
      "name": "魔法剑",
      "sprite": "./assets/arena/original-magicsword-073b1f7d45e9.webp",
      "width": 0.510000012530311,
      "height": 2.2128814103010104,
      "anchor": {
        "x": 0.0,
        "y": -0.7139999866485596
      },
      "handPosition": {
        "x": 0.0,
        "y": -0.7139999866485596
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.17453299891476076,
      "forwardAngle": -90.0,
      "holdAngle": 0.0,
      "invertX": true,
      "invertY": false,
      "pid": {
        "Kp": 6.0,
        "Ki": 0.0,
        "Kd": 1.0
      },
      "angleErrorClamp": 30.0,
      "mass": 3.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 44.0,
        "maxDamage": 120.0,
        "damageMultiplier": 1.100000023841858,
        "velocityMultiplier": 2.0,
        "itemReach": 2.5
      },
      "colliders": [
        {
          "type": "polygon",
          "points": [
            {
              "x": 0.08138441294431686,
              "y": -0.36677926778793335
            },
            {
              "x": 0.08772408962249756,
              "y": 0.8527138829231262
            },
            {
              "x": 0.001689821481704712,
              "y": 1.1693131923675537
            },
            {
              "x": -0.08115217834711075,
              "y": 0.858951210975647
            },
            {
              "x": -0.0901469886302948,
              "y": -0.36431387066841125
            },
            {
              "x": -0.25819265842437744,
              "y": -0.4341294765472412
            },
            {
              "x": -0.08479700982570648,
              "y": -0.4982750117778778
            },
            {
              "x": -0.08956733345985413,
              "y": -1.0894596576690674
            },
            {
              "x": 0.09155216813087463,
              "y": -1.0908886194229126
            },
            {
              "x": 0.08179790526628494,
              "y": -0.49996286630630493
            },
            {
              "x": 0.25522759556770325,
              "y": -0.43162786960601807
            }
          ]
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": true,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.800000011920929,
                  0.0
                ],
                [
                  -0.75,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.03999999910593033,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        },
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": true,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.75,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.5,
                  0.8999999761581421,
                  0.0
                ],
                [
                  1.899999976158142,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        0.0,
        0.0
      ],
      "ammo": null,
      "canBeThrown": true,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": []
    },
    "fire": {
      "name": "火球术",
      "sprite": null,
      "width": null,
      "height": null,
      "anchor": {
        "x": 0.0,
        "y": 0.0
      },
      "handPosition": {
        "x": 0.0,
        "y": 0.0
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.0,
      "forwardAngle": 0.0,
      "holdAngle": 0.0,
      "invertX": false,
      "invertY": true,
      "pid": {
        "Kp": 3.0,
        "Ki": 0.0,
        "Kd": 0.009999999776482582
      },
      "angleErrorClamp": 50.0,
      "mass": 1.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": false,
        "minDamageVelocity": 10.0,
        "minDamage": 10.0,
        "maxDamage": 35.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 0.5,
        "itemReach": 15.0
      },
      "colliders": [
        {
          "type": "circle",
          "center": {
            "x": 0.0,
            "y": 0.0
          },
          "radius": 0.25
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": false,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.75,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        1.0,
        1.25
      ],
      "ammo": -1,
      "canBeThrown": false,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": []
    },
    "bomb": {
      "name": "炸弹",
      "sprite": "./assets/arena/original-bomb-b456f224e198.webp",
      "width": 0.58,
      "height": 0.7733333333333333,
      "anchor": {
        "x": 0.0,
        "y": 0.0
      },
      "handPosition": {
        "x": -0.15000000596046448,
        "y": -0.20000000298023224
      },
      "handSprite": "./assets/arena/original-fist-02-6bd7dc68acd8.webp",
      "handRotation": 0.17453299891476076,
      "forwardAngle": 0.0,
      "holdAngle": 0.0,
      "invertX": false,
      "invertY": true,
      "pid": {
        "Kp": 3.0,
        "Ki": 0.0,
        "Kd": 0.10000000149011612
      },
      "angleErrorClamp": 30.0,
      "mass": 2.5,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": false,
        "minDamageVelocity": 10.0,
        "minDamage": 10.0,
        "maxDamage": 35.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 0.5,
        "itemReach": 15.0
      },
      "colliders": [
        {
          "type": "circle",
          "center": {
            "x": 0.0,
            "y": -0.10000000149011612
          },
          "radius": 0.30000001192092896
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": false,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.75,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        1.0,
        2.0
      ],
      "ammo": 3,
      "canBeThrown": false,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": []
    },
    "superfire": {
      "name": "强化火球术",
      "sprite": null,
      "width": null,
      "height": null,
      "anchor": {
        "x": 0.0,
        "y": 0.0
      },
      "handPosition": {
        "x": 0.0,
        "y": 0.0
      },
      "handSprite": "./assets/arena/original-holdinghand-02-547a835457f2.webp",
      "handRotation": 0.0,
      "forwardAngle": 0.0,
      "holdAngle": 0.0,
      "invertX": false,
      "invertY": true,
      "pid": {
        "Kp": 3.0,
        "Ki": 0.0,
        "Kd": 0.009999999776482582
      },
      "angleErrorClamp": 50.0,
      "mass": 1.0,
      "angularDrag": 0.05000000074505806,
      "stats": {
        "collisionDamage": false,
        "minDamageVelocity": 10.0,
        "minDamage": 10.0,
        "maxDamage": 35.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 0.5,
        "itemReach": 15.0
      },
      "colliders": [
        {
          "type": "circle",
          "center": {
            "x": 0.0,
            "y": 0.0
          },
          "radius": 0.25
        }
      ],
      "animations": [
        {
          "lockRotationToAngle": false,
          "rotatePathAngle": true,
          "invertPathX": true,
          "invertPathY": false,
          "idleTransitionSpeed": 0.33000001311302185,
          "idleTransitionDelay": 0.0,
          "activateItem": false,
          "setItemActivePosition": 0.20000000298023224,
          "sets": [
            {
              "speed": 0.20000000298023224,
              "delay": 0.0,
              "points": [
                [
                  0.0,
                  0.75,
                  0.0
                ],
                [
                  -1.0,
                  0.10000000149011612,
                  0.0
                ]
              ]
            },
            {
              "speed": 0.05000000074505806,
              "delay": 0.22499999403953552,
              "points": [
                [
                  0.20000000298023224,
                  0.8999999761581421,
                  0.0
                ],
                [
                  2.5,
                  -0.25,
                  0.0
                ]
              ]
            }
          ]
        }
      ],
      "throwAnimation": {
        "lockRotationToAngle": false,
        "rotatePathAngle": true,
        "invertPathX": true,
        "invertPathY": false,
        "idleTransitionSpeed": 0.33000001311302185,
        "idleTransitionDelay": 0.0,
        "activateItem": true,
        "setItemActivePosition": 0.0,
        "sets": [
          {
            "speed": 0.20000000298023224,
            "delay": 0.0,
            "points": [
              [
                0.0,
                0.75,
                0.0
              ],
              [
                -1.0,
                0.10000000149011612,
                0.0
              ]
            ]
          },
          {
            "speed": 0.05000000074505806,
            "delay": 0.22499999403953552,
            "points": [
              [
                0.20000000298023224,
                0.8999999761581421,
                0.0
              ],
              [
                1.5,
                -0.5,
                0.0
              ]
            ]
          }
        ]
      },
      "attackCooldown": [
        1.0,
        1.25
      ],
      "ammo": -1,
      "canBeThrown": false,
      "actionTime": [
        0.5249999761581421,
        0.5249999761581421
      ],
      "variants": []
    }
  },
  "projectiles": {
    "arrow": {
      "name": "箭",
      "sprite": "./assets/arena/original-arrow-07bdb3d21d66.webp",
      "width": 1.550000046193601,
      "height": 0.15742187969153762,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 5.0,
        "minDamage": 8.699999809265137,
        "maxDamage": 19.200000762939453,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 0.550000011920929,
        "itemReach": 0.0
      },
      "colliders": [
        {
          "type": "capsule",
          "center": {
            "x": 0.25,
            "y": 0.0
          },
          "width": 1.0499999523162842,
          "height": 0.10000000149011612,
          "direction": "horizontal"
        }
      ],
      "mass": 0.75,
      "angularDrag": 30.0,
      "gravityScale": 1.0,
      "explosionRadius": null,
      "explosionStrength": null,
      "explosionTime": null,
      "stickMaxDepth": 0.4000000059604645,
      "stickMinVelocity": 5.0,
      "inverseUpTransform": false,
      "renderMode": "sprite"
    },
    "fire": {
      "name": "火球",
      "sprite": null,
      "width": null,
      "height": null,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 10.0,
        "maxDamage": 40.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 0.5,
        "itemReach": 0.0
      },
      "colliders": [
        {
          "type": "circle",
          "center": {
            "x": 0.0,
            "y": 0.0
          },
          "radius": 0.30000001192092896
        }
      ],
      "mass": 1.0,
      "angularDrag": 0.05000000074505806,
      "gravityScale": 1.0,
      "explosionRadius": 1.5,
      "explosionStrength": 5.0,
      "explosionTime": null,
      "stickMaxDepth": null,
      "stickMinVelocity": null,
      "inverseUpTransform": null,
      "renderMode": "particles"
    },
    "superfire": {
      "name": "强化火球",
      "sprite": null,
      "width": null,
      "height": null,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 15.0,
        "maxDamage": 55.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 0.5,
        "itemReach": 0.0
      },
      "colliders": [
        {
          "type": "circle",
          "center": {
            "x": 0.0,
            "y": 0.0
          },
          "radius": 0.25
        }
      ],
      "mass": 1.2999999523162842,
      "angularDrag": 0.05000000074505806,
      "gravityScale": 1.0,
      "explosionRadius": 1.600000023841858,
      "explosionStrength": 8.0,
      "explosionTime": null,
      "stickMaxDepth": null,
      "stickMinVelocity": null,
      "inverseUpTransform": null,
      "renderMode": "particles"
    },
    "bomb": {
      "name": "炸弹",
      "sprite": "./assets/arena/original-bomb-b456f224e198.webp",
      "width": 0.58,
      "height": 0.7733333333333333,
      "stats": {
        "collisionDamage": true,
        "minDamageVelocity": 10.0,
        "minDamage": 37.0,
        "maxDamage": 63.0,
        "damageMultiplier": 1.0,
        "velocityMultiplier": 1.0,
        "itemReach": 0.0
      },
      "colliders": [
        {
          "type": "circle",
          "center": {
            "x": 0.0,
            "y": -0.10000000149011612
          },
          "radius": 0.30000001192092896
        }
      ],
      "mass": 1.0,
      "angularDrag": 0.05000000074505806,
      "gravityScale": 1.0,
      "explosionRadius": 5.0,
      "explosionStrength": 9.0,
      "explosionTime": 3.0,
      "stickMaxDepth": null,
      "stickMinVelocity": null,
      "inverseUpTransform": null,
      "renderMode": "sprite"
    }
  },
  "killBadge": {
    "sprite": "./assets/arena/original-killcounticon-eb47ba871255.webp",
    "colors": [
      {
        "threshold": 3,
        "color": {
          "topLeft": [
            1.0,
            0.7688679099082947,
            0.7688679099082947,
            1.0
          ],
          "topRight": [
            1.0,
            0.7686275243759155,
            0.7686275243759155,
            1.0
          ],
          "bottomLeft": [
            1.0,
            0.7686275243759155,
            0.7686275243759155,
            1.0
          ],
          "bottomRight": [
            1.0,
            0.7686275243759155,
            0.7686275243759155,
            1.0
          ]
        }
      },
      {
        "threshold": 5,
        "color": {
          "topLeft": [
            1.0,
            0.5896226167678833,
            0.5896226167678833,
            1.0
          ],
          "topRight": [
            1.0,
            0.5882353186607361,
            0.5882353186607361,
            1.0
          ],
          "bottomLeft": [
            1.0,
            0.5882353186607361,
            0.5882353186607361,
            1.0
          ],
          "bottomRight": [
            1.0,
            0.5882353186607361,
            0.5882353186607361,
            1.0
          ]
        }
      },
      {
        "threshold": 8,
        "color": {
          "topLeft": [
            1.0,
            0.41981130838394165,
            0.41981130838394165,
            1.0
          ],
          "topRight": [
            1.0,
            0.41960787773132324,
            0.41960787773132324,
            1.0
          ],
          "bottomLeft": [
            1.0,
            0.41960787773132324,
            0.41960787773132324,
            1.0
          ],
          "bottomRight": [
            1.0,
            0.41960787773132324,
            0.41960787773132324,
            1.0
          ]
        }
      },
      {
        "threshold": 10,
        "color": {
          "topLeft": [
            1.0,
            0.04524886980652809,
            0.0,
            1.0
          ],
          "topRight": [
            1.0,
            0.04524886980652809,
            0.0,
            1.0
          ],
          "bottomLeft": [
            1.0,
            0.7725490927696228,
            0.6823529601097107,
            1.0
          ],
          "bottomRight": [
            1.0,
            0.7725490927696228,
            0.6823529601097107,
            1.0
          ]
        }
      },
      {
        "threshold": 15,
        "color": {
          "topLeft": [
            1.0,
            0.42533940076828003,
            0.0,
            1.0
          ],
          "topRight": [
            1.0,
            0.42533940076828003,
            0.0,
            1.0
          ],
          "bottomLeft": [
            1.0,
            0.9951691031455994,
            0.0,
            1.0
          ],
          "bottomRight": [
            1.0,
            0.9951691031455994,
            0.0,
            1.0
          ]
        }
      },
      {
        "threshold": 20,
        "color": {
          "topLeft": [
            0.0,
            0.988235354423523,
            1.0,
            1.0
          ],
          "topRight": [
            0.0,
            0.988235354423523,
            1.0,
            1.0
          ],
          "bottomLeft": [
            0.364705890417099,
            0.5215686559677124,
            1.0,
            1.0
          ],
          "bottomRight": [
            0.364705890417099,
            0.5215686559677124,
            1.0,
            1.0
          ]
        }
      },
      {
        "threshold": 30,
        "color": {
          "topLeft": [
            0.0,
            1.0,
            0.18060636520385742,
            1.0
          ],
          "topRight": [
            0.0,
            1.0,
            0.18039216101169586,
            1.0
          ],
          "bottomLeft": [
            0.4745098352432251,
            1.0,
            0.8675413727760315,
            1.0
          ],
          "bottomRight": [
            0.4745098352432251,
            1.0,
            0.8666667342185974,
            1.0
          ]
        }
      },
      {
        "threshold": 40,
        "color": {
          "topLeft": [
            1.0,
            0.0,
            1.0,
            1.0
          ],
          "topRight": [
            1.0,
            0.0,
            1.0,
            1.0
          ],
          "bottomLeft": [
            0.943462073802948,
            0.7607843279838562,
            1.0,
            1.0
          ],
          "bottomRight": [
            0.9450981020927429,
            0.760784387588501,
            1.0,
            1.0
          ]
        }
      },
      {
        "threshold": 50,
        "color": {
          "topLeft": [
            0.7490196228027344,
            0.125490203499794,
            0.125490203499794,
            1.0
          ],
          "topRight": [
            0.7490196228027344,
            0.125490203499794,
            0.125490203499794,
            1.0
          ],
          "bottomLeft": [
            1.0,
            0.0,
            0.0,
            1.0
          ],
          "bottomRight": [
            1.0,
            0.0,
            0.0,
            1.0
          ]
        }
      }
    ],
    "leaderColor": {
      "topLeft": [
        1.0,
        1.0,
        0.0,
        1.0
      ],
      "topRight": [
        1.0,
        1.0,
        0.0,
        1.0
      ],
      "bottomLeft": [
        1.0,
        1.0,
        0.8549020290374756,
        1.0
      ],
      "bottomRight": [
        1.0,
        1.0,
        0.8537735939025879,
        1.0
      ]
    },
    "totalColor": [
      0.572549045085907,
      1.0,
      0.3843137323856354,
      1.0
    ],
    "punchScale": 0.25,
    "punchDuration": 0.3,
    "punchVibrato": 10,
    "punchElasticity": 0
  },
  "pickups": {
    "heal": {
      "name": "治疗弹",
      "sprite": "./assets/arena/original-healbomb-7dccf59cd27a.webp",
      "width": 0.58,
      "height": 0.7733333333333333
    }
  }
};
  const freeze = (value) => {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  globalThis.GVYArenaWeaponProfile = freeze(profile);
})();
