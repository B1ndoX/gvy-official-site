// Measured source configuration; browser scene timing adaptations live in the runtime.
(()=>{ globalThis.GVYArenaProfile = Object.freeze({
  "version": "Intro Fighters 3.2",
  "zipSha256": "0d943e7e9d5194f5ed994f97ca121438a8cc41ea1639a6743505ee222fe56c1c",
  "source": "https://lexone.itch.io/introfighters",
  "health": 100,
  "weaponStats": {
    "fists": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 10,
      "maxDamage": 30,
      "damageMultiplier": 1,
      "velocityMultiplier": 0.800000011920929,
      "itemReach": 1
    },
    "shortsword": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 20,
      "maxDamage": 35,
      "damageMultiplier": 1,
      "velocityMultiplier": 1,
      "itemReach": 2
    },
    "sword": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 20,
      "maxDamage": 50,
      "damageMultiplier": 1.25,
      "velocityMultiplier": 1.100000023841858,
      "itemReach": 3
    },
    "special": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 20,
      "maxDamage": 30,
      "damageMultiplier": 1,
      "velocityMultiplier": 1,
      "itemReach": 2
    },
    "spear": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 21,
      "maxDamage": 37,
      "damageMultiplier": 1,
      "velocityMultiplier": 1.2000000476837158,
      "itemReach": 4
    },
    "pitchfork": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 18,
      "maxDamage": 33,
      "damageMultiplier": 1,
      "velocityMultiplier": 1,
      "itemReach": 3
    },
    "axe": {
      "collisionDamage": true,
      "minDamageVelocity": 7.5,
      "minDamage": 10,
      "maxDamage": 35,
      "damageMultiplier": 2,
      "velocityMultiplier": 1,
      "itemReach": 2
    },
    "mace": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 15,
      "maxDamage": 50,
      "damageMultiplier": 1,
      "velocityMultiplier": 1.149999976158142,
      "itemReach": 3
    },
    "bow": {
      "collisionDamage": true,
      "minDamageVelocity": 5,
      "minDamage": 8.699999809265137,
      "maxDamage": 19.200000762939453,
      "damageMultiplier": 1,
      "velocityMultiplier": 0.550000011920929,
      "itemReach": 0
    },
    "magic": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 44,
      "maxDamage": 120,
      "damageMultiplier": 1.100000023841858,
      "velocityMultiplier": 2,
      "itemReach": 2.5
    },
    "fire": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 10,
      "maxDamage": 40,
      "damageMultiplier": 1,
      "velocityMultiplier": 0.5,
      "itemReach": 0
    },
    "bomb": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 37,
      "maxDamage": 63,
      "damageMultiplier": 1,
      "velocityMultiplier": 1,
      "itemReach": 0
    },
    "superfire": {
      "collisionDamage": true,
      "minDamageVelocity": 10,
      "minDamage": 15,
      "maxDamage": 55,
      "damageMultiplier": 1,
      "velocityMultiplier": 0.5,
      "itemReach": 0
    }
  },
  "timedModifiers": {
    "low-gravity": [
      16,
      22
    ],
    "zero-gravity": [
      16,
      22
    ],
    "slow": [
      16,
      25
    ],
    "instakill": [
      14,
      20
    ],
    "bouncy": [
      15,
      24
    ],
    "explosive": [
      16,
      22
    ],
    "inverted": [
      16,
      25
    ]
  },
  "personality": {
    "attackCooldown": [
      0.175,
      0.55
    ],
    "cooldownMultiplier": [
      1,
      2.9
    ],
    "jumpStrength": [
      9,
      16.2
    ],
    "rangedRetreatChance": [
      0.3,
      0.67
    ],
    "throwChance": 0.35,
    "throwAfter": [
      3,
      7
    ]
  },
  "terrains": {
    "smallhill": {
      "id": "smallhill",
      "generated": true,
      "seedSplinePoints": [
        [
          -1,
          0
        ],
        [
          0,
          0
        ],
        [
          1,
          0
        ]
      ],
      "curve": {
        "points": 5,
        "spacing": 2.25,
        "amplitude": 1,
        "tangentLength": 0.25,
        "endPointYOffset": -0.5,
        "addNoise": true,
        "additionalRandomVariety": true,
        "perlinRange": [
          1,
          3
        ],
        "curve": {
          "keys": [
            [
              0,
              0,
              1.36211359500885,
              1.36211359500885,
              0,
              0,
              0.3333333432674408
            ],
            [
              0.42409175634384155,
              0.5776611566543579,
              0.4524499177932739,
              0.4524499177932739,
              0,
              0.19716386497020721,
              0.545190155506134
            ],
            [
              0.5,
              1,
              0,
              0,
              0,
              0.3333333432674408,
              0.3333333432674408
            ],
            [
              1,
              0,
              -2,
              -2,
              0,
              0.3333333432674408,
              0
            ]
          ],
          "preInfinity": 2,
          "postInfinity": 2,
          "rotationOrder": 4
        }
      },
      "maxScale": 6
    },
    "pit": {
      "id": "pit",
      "generated": true,
      "seedSplinePoints": [
        [
          -1,
          0
        ],
        [
          0,
          0
        ],
        [
          1,
          0
        ]
      ],
      "curve": {
        "points": 10,
        "spacing": 1.399999976158142,
        "amplitude": 1,
        "tangentLength": 0.5,
        "endPointYOffset": -0.5,
        "addNoise": true,
        "additionalRandomVariety": true,
        "perlinRange": [
          1,
          2
        ],
        "curve": {
          "keys": [
            [
              0,
              0.800000011920929,
              -1.600000023841858,
              -1.600000023841858,
              0,
              0,
              0.3333333432674408
            ],
            [
              0.5,
              0,
              0,
              0,
              0,
              0.3333333432674408,
              0.3333333432674408
            ],
            [
              1,
              0.800000011920929,
              1.600000023841858,
              1.600000023841858,
              0,
              0.3333333432674408,
              0
            ]
          ],
          "preInfinity": 2,
          "postInfinity": 2,
          "rotationOrder": 4
        }
      },
      "maxScale": 6
    },
    "canyon": {
      "id": "canyon",
      "generated": true,
      "seedSplinePoints": [
        [
          -1,
          0
        ],
        [
          0,
          0
        ],
        [
          1,
          0
        ]
      ],
      "curve": {
        "points": 10,
        "spacing": 1.100000023841858,
        "amplitude": 1,
        "tangentLength": 0.5,
        "endPointYOffset": -3,
        "addNoise": true,
        "additionalRandomVariety": true,
        "perlinRange": [
          1,
          2
        ],
        "curve": {
          "keys": [
            [
              0,
              0,
              5,
              5,
              0,
              0,
              0.3333333432674408
            ],
            [
              0.20000000298023224,
              1,
              -3.274501085281372,
              -3.274501085281372,
              0,
              0.3333333432674408,
              0.158730149269104
            ],
            [
              0.5,
              -1,
              1.350281000137329,
              -1.2657763957977295,
              0,
              0.1984127312898636,
              0.1984127312898636
            ],
            [
              0.800000011920929,
              1,
              4.914989948272705,
              4.914989948272705,
              0,
              0.1944444477558136,
              0.3333333432674408
            ],
            [
              1,
              0,
              -5.000000476837158,
              -5.000000476837158,
              0,
              0.3333333432674408,
              0
            ]
          ],
          "preInfinity": 2,
          "postInfinity": 2,
          "rotationOrder": 4
        }
      },
      "maxScale": 6
    },
    "default": {
      "id": "default",
      "generated": true,
      "seedSplinePoints": [
        [
          -1,
          0
        ],
        [
          0,
          0
        ],
        [
          1,
          0
        ]
      ],
      "curve": {
        "points": 10,
        "spacing": 1.399999976158142,
        "amplitude": 1,
        "tangentLength": 0.5,
        "endPointYOffset": -0.5,
        "addNoise": true,
        "additionalRandomVariety": true,
        "perlinRange": [
          1,
          2
        ],
        "curve": {
          "keys": [
            [
              0,
              0,
              2,
              2,
              0,
              0,
              0.3333333432674408
            ],
            [
              0.5,
              1,
              0,
              0,
              0,
              0.3333333432674408,
              0.3333333432674408
            ],
            [
              1,
              0,
              -2,
              -2,
              0,
              0.3333333432674408,
              0
            ]
          ],
          "preInfinity": 2,
          "postInfinity": 2,
          "rotationOrder": 4
        }
      },
      "maxScale": 6
    },
    "terrain01": {
      "id": "terrain01",
      "generated": false,
      "seedSplinePoints": [
        [
          -4,
          -0.5
        ],
        [
          -3,
          1
        ],
        [
          -3,
          4
        ],
        [
          0,
          4
        ],
        [
          3,
          4
        ],
        [
          3,
          1
        ],
        [
          4,
          -0.5
        ]
      ],
      "curve": {
        "points": 20,
        "spacing": 1,
        "amplitude": 1,
        "tangentLength": 0.5,
        "endPointYOffset": -0.5,
        "addNoise": false,
        "additionalRandomVariety": false,
        "perlinRange": [
          5,
          20
        ],
        "curve": {
          "keys": [],
          "preInfinity": 2,
          "postInfinity": 2,
          "rotationOrder": 4
        }
      },
      "maxScale": 6
    },
    "slope": {
      "id": "slope",
      "generated": true,
      "seedSplinePoints": [
        [
          -1,
          0
        ],
        [
          0,
          0
        ],
        [
          1,
          0
        ]
      ],
      "curve": {
        "points": 8,
        "spacing": 1.2000000476837158,
        "amplitude": 1,
        "tangentLength": 0.5,
        "endPointYOffset": -0.5,
        "addNoise": false,
        "additionalRandomVariety": true,
        "perlinRange": [
          1,
          3
        ],
        "curve": {
          "keys": [
            [
              0,
              0,
              0,
              1.8000030517578125,
              0,
              0,
              0.33716511726379395
            ],
            [
              0.5,
              0.9000015258789062,
              0,
              0,
              0,
              0.3333333432674408,
              0.3333333432674408
            ],
            [
              1,
              0,
              -1.8000030517578125,
              -1.6000518798828125,
              0,
              0.3333333432674408,
              0
            ]
          ],
          "preInfinity": 2,
          "postInfinity": 2,
          "rotationOrder": 4
        }
      },
      "maxScale": 6
    },
    "terrain02": {
      "id": "terrain02",
      "generated": false,
      "seedSplinePoints": [
        [
          -5,
          0
        ],
        [
          -3.5,
          1.350000023841858
        ],
        [
          -1,
          2
        ],
        [
          0,
          3
        ],
        [
          1,
          2
        ],
        [
          3.5,
          1.350000023841858
        ],
        [
          5,
          0
        ]
      ],
      "curve": {
        "points": 20,
        "spacing": 1,
        "amplitude": 1,
        "tangentLength": 0.5,
        "endPointYOffset": -0.5,
        "addNoise": false,
        "additionalRandomVariety": false,
        "perlinRange": [
          5,
          20
        ],
        "curve": {
          "keys": [],
          "preInfinity": 2,
          "postInfinity": 2,
          "rotationOrder": 4
        }
      },
      "maxScale": 6
    }
  },
  "maps": {
    "classicWeights": {
      "default": 130,
      "terrain01": 20,
      "terrain02": 20
    },
    "teamWeights": {
      "smallhill": 100,
      "default": 100,
      "pit": 100,
      "slope": 100,
      "terrain01": 300,
      "terrain02": 100,
      "canyon": 100
    },
    "teamCamera": 9,
    "initialBoxesChance": 0.45,
    "boxGroups": {
      "3x3Boxes": [
        {
          "x": -0.8999998569488525,
          "y": -0.8929998874664307
        },
        {
          "x": 0,
          "y": -0.8929998874664307
        },
        {
          "x": 0.8999999761581421,
          "y": -0.8929998874664307
        },
        {
          "x": -0.8999998569488525,
          "y": 0
        },
        {
          "x": 0,
          "y": 0
        },
        {
          "x": 0.8999999761581421,
          "y": 0
        },
        {
          "x": -0.8999998569488525,
          "y": 0.8849999904632568
        },
        {
          "x": 0,
          "y": 0.8849999904632568
        },
        {
          "x": 0.8999999761581421,
          "y": 0.8849999904632568
        }
      ],
      "3x9Boxes": [
        {
          "x": -0.8999998569488525,
          "y": -0.8929998874664307
        },
        {
          "x": 0,
          "y": -0.8929998874664307
        },
        {
          "x": 0.8999999761581421,
          "y": -0.8929998874664307
        },
        {
          "x": -0.8999998569488525,
          "y": 0
        },
        {
          "x": 0,
          "y": 0
        },
        {
          "x": 0.8999999761581421,
          "y": 0
        },
        {
          "x": -0.8999998569488525,
          "y": 0.8849999904632568
        },
        {
          "x": 0,
          "y": 0.8849999904632568
        },
        {
          "x": 0.8999999761581421,
          "y": 0.8849999904632568
        },
        {
          "x": -0.8999998569488525,
          "y": 1.8570001125335693
        },
        {
          "x": 0,
          "y": 1.8570001125335693
        },
        {
          "x": 0.8999999761581421,
          "y": 1.8570001125335693
        },
        {
          "x": -0.8999998569488525,
          "y": 2.75
        },
        {
          "x": 0,
          "y": 2.75
        },
        {
          "x": 0.8999999761581421,
          "y": 2.75
        },
        {
          "x": -0.8999998569488525,
          "y": 3.634999990463257
        },
        {
          "x": 0,
          "y": 3.634999990463257
        },
        {
          "x": 0.8999999761581421,
          "y": 3.634999990463257
        },
        {
          "x": -0.8999998569488525,
          "y": 4.607000350952148
        },
        {
          "x": 0,
          "y": 4.607000350952148
        },
        {
          "x": 0.8999999761581421,
          "y": 4.607000350952148
        },
        {
          "x": -0.8999998569488525,
          "y": 5.5
        },
        {
          "x": 0,
          "y": 5.5
        },
        {
          "x": 0.8999999761581421,
          "y": 5.5
        },
        {
          "x": -0.8999998569488525,
          "y": 6.385000228881836
        },
        {
          "x": 0,
          "y": 6.385000228881836
        },
        {
          "x": 0.8999999761581421,
          "y": 6.385000228881836
        }
      ]
    },
    "groupBox": {
      "size": 0.888,
      "health": 10,
      "mass": 3
    },
    "droppedBox": {
      "size": 1.11,
      "health": 30,
      "mass": 10
    },
    "terrainDelay": [
      12000,
      19000
    ],
    "eventDelay": [
      8000,
      26000
    ],
    "eventWeights": {
      "Boxes": 620,
      "Healing": 800,
      "JumpZones": 450,
      "GravityWell": 5
    },
    "jump": {
      "radius": 0.6,
      "strength": 7.5,
      "duration": 30000
    },
    "gravity": {
      "radius": 10,
      "duration": [
        12500,
        25000
      ],
      "directionInterval": 2500
    }
  }
}); })();
