export const E2E_EXPECTATIONS = [
  {
    answers: [1, 2, 3, 4, 1],
    choreChips: [
      { label: 'the mugs', count: 3 },
      { label: 'the wrappers', count: 4 },
      { label: 'the laundry', count: 3 },
    ],
    assertions: {
      // Monday: mmo 0, household 30, vibe 20, comedy 4, and total 54.
      householdRow: '30 / 30',
      rows: ['0 / 40', '30 / 30', '20 / 20', '4 / 10'],
      total: '54 / 100',
      ending: 'Employee of the Month (This House)',
      notes: ['100 gp dinner fund'],
    },
  },
  {
    answers: [1, 2, 3, 4, 1],
    choreChips: [
      { label: 'the mugs', count: 3 },
      { label: 'the bed', count: 2 },
      { label: 'the wrappers', count: 4 },
    ],
    assertions: {
      householdRow: '30 / 30',
    },
  },
  {
    answers: [1, 2, 3, 4, 1],
    choreChips: [
      { label: 'the mugs', count: 3 },
      { label: 'the laundry', count: 3 },
      { label: 'the bed', count: 2 },
    ],
    assertions: {
      householdRow: '30 / 30',
    },
  },
  {
    answers: [1, 2, 3, 4, 1],
    choreChips: [
      { label: 'the wrappers', count: 4 },
      { label: 'the curtains', count: 2 },
      { label: 'the laundry', count: 3 },
    ],
    assertions: {
      householdRow: '30 / 30',
    },
  },
  {
    answers: [1, 2, 3, 4, 1],
    choreChips: [
      { label: 'the mugs', count: 3 },
      { label: 'the wrappers', count: 5 },
      { label: 'the laundry', count: 3 },
    ],
    assertions: {
      householdRow: '30 / 30',
    },
  },
];
