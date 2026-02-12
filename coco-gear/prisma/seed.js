import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
  // Skip seeding if data already exists (prevents wiping on container restart)
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log('Database already seeded — skipping. Use "npm run db:reset" to re-seed.');
    return;
  }

  console.log('Seeding database...');

  // Clear existing data
  await prisma.$transaction([
    prisma.inspectionPhoto.deleteMany(),
    prisma.inspectionResult.deleteMany(),
    prisma.inspection.deleteMany(),
    prisma.kitPhoto.deleteMany(),
    prisma.kitCalibrationDate.deleteMany(),
    prisma.kitSerial.deleteMany(),
    prisma.kitComponentStatus.deleteMany(),
    prisma.kitFieldValue.deleteMany(),
    prisma.issueHistory.deleteMany(),
    prisma.checkoutRequest.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.maintenanceHistory.deleteMany(),
    prisma.assetIssueHistory.deleteMany(),
    prisma.standaloneAsset.deleteMany(),
    prisma.consumable.deleteMany(),
    prisma.kit.deleteMany(),
    prisma.kitTypeComponent.deleteMany(),
    prisma.kitTypeField.deleteMany(),
    prisma.kitType.deleteMany(),
    prisma.component.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.systemSetting.deleteMany(),
    prisma.user.deleteMany(),
    prisma.department.deleteMany(),
    prisma.location.deleteMany(),
  ]);

  const pin = await bcrypt.hash('password', SALT_ROUNDS);

  // ─── Locations ───
  const locs = await Promise.all([
    prisma.location.create({ data: { name: 'DAWG (VB)', shortCode: 'DAWG' } }),
    prisma.location.create({ data: { name: 'FTX - GTX', shortCode: 'GTX' } }),
    prisma.location.create({ data: { name: 'GTX - Demo', shortCode: 'DEMO' } }),
    prisma.location.create({ data: { name: 'ATX BL7', shortCode: 'ATX' } }),
    prisma.location.create({ data: { name: 'ATS', shortCode: 'ATS' } }),
    prisma.location.create({ data: { name: 'MOPS Trailer', shortCode: 'MOPS' } }),
    prisma.location.create({ data: { name: 'Field Site Alpha', shortCode: 'ALPHA' } }),
    prisma.location.create({ data: { name: 'Maintenance Bay', shortCode: 'MAINT' } }),
  ]);
  console.log(`  Created ${locs.length} locations`);

  // ─── Departments ───
  const depts = await Promise.all([
    prisma.department.create({ data: { name: 'Comms', color: '#60a5fa' } }),
    prisma.department.create({ data: { name: 'Optics', color: '#a78bfa' } }),
    prisma.department.create({ data: { name: 'Logistics', color: '#2dd4bf' } }),
  ]);
  console.log(`  Created ${depts.length} departments`);

  // ─── Personnel ───
  const users = await Promise.all([
    prisma.user.create({ data: { name: 'Jordan Martinez', title: 'Operations Director', role: 'super', pin, mustChangePassword: false, deptId: null } }),
    prisma.user.create({ data: { name: 'Riley Chen', title: 'Field Technician', role: 'user', pin, mustChangePassword: false, deptId: depts[0].id } }),
    prisma.user.create({ data: { name: 'Drew Williams', title: 'Project Manager', role: 'lead', pin, mustChangePassword: false, deptId: depts[0].id } }),
    prisma.user.create({ data: { name: 'Kim Thompson', title: 'Engineer', role: 'lead', pin, mustChangePassword: false, deptId: depts[1].id } }),
    prisma.user.create({ data: { name: 'Morgan Davis', title: 'Analyst', role: 'user', pin, mustChangePassword: false, deptId: depts[2].id } }),
    prisma.user.create({ data: { name: 'Taylor Nguyen', title: 'Team Lead', role: 'admin', pin, mustChangePassword: false, deptId: null } }),
    prisma.user.create({ data: { name: 'Lee Garcia', title: 'Technician', role: 'user', pin, mustChangePassword: false, deptId: depts[1].id } }),
    prisma.user.create({ data: { name: 'Ash Patel', title: 'Support Specialist', role: 'user', pin, mustChangePassword: false, deptId: depts[2].id } }),
  ]);
  console.log(`  Created ${users.length} users`);

  // Wire dept managers and leads
  await Promise.all([
    prisma.departmentManager.create({ data: { deptId: depts[0].id, userId: users[5].id } }),
    prisma.departmentManager.create({ data: { deptId: depts[1].id, userId: users[0].id } }),
    prisma.departmentManager.create({ data: { deptId: depts[2].id, userId: users[5].id } }),
    prisma.departmentManager.create({ data: { deptId: depts[2].id, userId: users[0].id } }),
    prisma.departmentLead.create({ data: { deptId: depts[0].id, userId: users[2].id } }),
    prisma.departmentLead.create({ data: { deptId: depts[1].id, userId: users[3].id } }),
  ]);

  // ─── Components ───
  const comps = await Promise.all([
    prisma.component.create({ data: { key: 'pelican', label: 'Pelican Case', category: 'Cases', serialized: true } }),
    prisma.component.create({ data: { key: 'goalZero', label: 'Goal Zero', category: 'Power', serialized: true } }),
    prisma.component.create({ data: { key: 'gzCharger', label: 'GZ Charger', category: 'Power', serialized: false } }),
    prisma.component.create({ data: { key: 'uxv', label: 'UXV', category: 'Comms', serialized: true, calibrationRequired: true, calibrationIntervalDays: 365 } }),
    prisma.component.create({ data: { key: 'uxvCharger', label: 'UXV Charger', category: 'Power', serialized: false } }),
    prisma.component.create({ data: { key: 'silvus4200', label: 'Silvus 4200', category: 'Comms', serialized: true, calibrationRequired: true, calibrationIntervalDays: 180 } }),
    prisma.component.create({ data: { key: 'silvusBatt', label: 'Silvus Battery', category: 'Power', serialized: true } }),
    prisma.component.create({ data: { key: 'silvusDockCh', label: 'Silvus Dock Charger', category: 'Power', serialized: true } }),
    prisma.component.create({ data: { key: 'silvusDock', label: 'Silvus Batt Dock', category: 'Power', serialized: true } }),
    prisma.component.create({ data: { key: 'hiGainAnt', label: 'Hi-Gain Antenna', category: 'Comms', serialized: false } }),
    prisma.component.create({ data: { key: 'loGainAnt', label: 'Lo-Gain Antenna', category: 'Comms', serialized: false } }),
    prisma.component.create({ data: { key: 'uxvEthCbl', label: 'UXV Ethernet Cable', category: 'Cables', serialized: false } }),
    prisma.component.create({ data: { key: 'uxvSilvCbl', label: 'UXV Silvus Cable', category: 'Cables', serialized: false } }),
    prisma.component.create({ data: { key: 'wifiDongle', label: 'Wi-Fi Dongle', category: 'Comms', serialized: false } }),
    prisma.component.create({ data: { key: 'ptt', label: 'PTT', category: 'Comms', serialized: true } }),
    prisma.component.create({ data: { key: 'silvEthCord', label: 'Silvus-Ethernet Cord', category: 'Cables', serialized: false } }),
    prisma.component.create({ data: { key: 'rj45', label: 'RJ45 Coupler', category: 'Cables', serialized: false } }),
    prisma.component.create({ data: { key: 'ethUsbc', label: 'Ethernet USB-C', category: 'Cables', serialized: false } }),
    prisma.component.create({ data: { key: 'radioPouch', label: 'Radio Pouch', category: 'Cases', serialized: false } }),
  ]);
  console.log(`  Created ${comps.length} components`);

  // ─── Kit Types ───
  const silvusBattComp = comps.find(c => c.key === 'silvusBatt');
  // Critical components: UXV, Silvus 4200, and Pelican Case are critical for COCO kits
  const criticalKeys = ['uxv', 'silvus4200', 'pelican'];
  const criticalIds = new Set(comps.filter(c => criticalKeys.includes(c.key)).map(c => c.id));
  const cocoType = await prisma.kitType.create({
    data: {
      name: 'COCO Kit',
      desc: 'Standard comms kit',
      components: {
        create: comps.map(c => ({
          componentId: c.id,
          quantity: c.id === silvusBattComp.id ? 2 : 1,
          critical: criticalIds.has(c.id),
        })),
      },
      fields: {
        create: [
          { key: 'uxvModel', label: 'UXV Model', type: 'text' },
          { key: 'silvusIP', label: 'Silvus IP', type: 'text' },
        ],
      },
    },
  });

  const starlinkType = await prisma.kitType.create({
    data: {
      name: 'Starlink Kit',
      desc: 'Starlink connectivity',
      fields: {
        create: [
          { key: 'miniPanel', label: 'Panel S/N', type: 'text' },
          { key: 'ecoflow', label: 'EcoFlow #', type: 'text' },
        ],
      },
    },
  });

  const nvgType = await prisma.kitType.create({
    data: {
      name: 'NVG Set',
      desc: 'PVS-31 night vision',
      fields: {
        create: [
          { key: 'serial', label: 'Serial', type: 'text' },
          { key: 'hasMount', label: 'Mount', type: 'toggle' },
        ],
      },
    },
  });
  console.log('  Created 3 kit types');

  // Get all COCO kit type components for slot expansion
  const typeComps = await prisma.kitTypeComponent.findMany({ where: { kitTypeId: cocoType.id } });

  // ─── Kits ───
  const kitDefs = [
    { color: 'PINK', locId: locs[0].id, uxv: 'Micronav 16', ip: '172.17.126.251', chk: '2026-01-20', iss: null, dept: depts[0].id, maint: null },
    { color: 'RED', locId: locs[0].id, uxv: 'Micronav 8', ip: '172.17.127.242', chk: '2026-01-18', iss: users[1].id, dept: depts[0].id, maint: null },
    { color: 'ORANGE', locId: locs[0].id, uxv: 'Micronav 121', ip: '172.17.132.181', chk: null, iss: null, dept: null, maint: null },
    { color: 'YELLOW', locId: locs[1].id, uxv: 'Micronav 120', ip: '172.17.87.165', chk: '2026-01-09', iss: users[2].id, dept: depts[0].id, maint: null },
    { color: 'PURPLE', locId: locs[1].id, uxv: 'Micronav 104', ip: '172.17.131.108', chk: '2026-01-09', iss: users[3].id, dept: depts[1].id, maint: null },
    { color: 'GREEN', locId: locs[2].id, uxv: 'Micronav 100', ip: '172.17.134.5', chk: '2026-01-29', iss: null, dept: null, maint: null },
    { color: 'WHITE', locId: locs[0].id, uxv: 'Micronav 15', ip: '172.17.126.254', chk: '2025-12-15', iss: null, dept: depts[1].id, maint: null },
    { color: 'BLUE', locId: locs[2].id, uxv: 'Micronav 105', ip: '172.17.127.244', chk: '2026-01-29', iss: users[6].id, dept: depts[1].id, maint: null },
    { color: 'BROWN', locId: locs[3].id, uxv: 'Micronav 103', ip: '172.18.70.220', chk: '2026-01-27', iss: null, dept: depts[2].id, maint: null },
    { color: 'CHECKER', locId: locs[3].id, uxv: 'Micronav 101', ip: '172.18.67.89', chk: '2026-01-27', iss: null, dept: null, maint: null },
    { color: 'RWB', locId: locs[3].id, uxv: 'Micronav 106', ip: '', chk: '2026-01-27', iss: users[7].id, dept: depts[2].id, maint: null },
    { color: 'GOLD', locId: locs[7].id, uxv: 'Micronav 102', ip: '', chk: '2025-11-10', iss: null, dept: null, maint: 'repair' },
  ];

  const kits = [];
  for (const def of kitDefs) {
    const kit = await prisma.kit.create({
      data: {
        typeId: cocoType.id,
        color: def.color,
        locId: def.locId,
        deptId: def.dept,
        issuedToId: def.iss,
        lastChecked: def.chk ? new Date(def.chk) : null,
        maintenanceStatus: def.maint,
      },
    });

    // Create field values
    await prisma.kitFieldValue.createMany({
      data: [
        { kitId: kit.id, key: 'uxvModel', value: def.uxv },
        { kitId: kit.id, key: 'silvusIP', value: def.ip },
      ],
    });

    // Create component statuses, serials, calibration dates for each slot
    for (const tc of typeComps) {
      for (let i = 0; i < tc.quantity; i++) {
        await prisma.kitComponentStatus.create({
          data: { kitId: kit.id, componentId: tc.componentId, slotIndex: i, status: 'GOOD' },
        });
        await prisma.kitSerial.create({
          data: { kitId: kit.id, componentId: tc.componentId, slotIndex: i, serial: '' },
        });
        await prisma.kitCalibrationDate.create({
          data: { kitId: kit.id, componentId: tc.componentId, slotIndex: i, calibDate: null },
        });
      }
    }

    // Create issue history for checked-out kits
    if (def.iss) {
      await prisma.issueHistory.create({
        data: {
          kitId: kit.id,
          personId: def.iss,
          issuedById: users[0].id,
          issuedDate: new Date('2026-01-15'),
          checkoutLocId: def.locId,
        },
      });
    }

    // Create inspections for first 4 kits
    if (kits.length < 4) {
      const inspection = await prisma.inspection.create({
        data: {
          kitId: kit.id,
          inspector: 'System',
          date: new Date(`2026-01-${15 + kits.length}`),
          notes: 'Initial inspection',
        },
      });

      for (const tc of typeComps) {
        for (let i = 0; i < tc.quantity; i++) {
          await prisma.inspectionResult.create({
            data: { inspectionId: inspection.id, componentId: tc.componentId, slotIndex: i, status: 'GOOD' },
          });
        }
      }
    }

    // Create maintenance history for maintenance kit
    if (def.maint) {
      await prisma.maintenanceHistory.create({
        data: {
          kitId: kit.id,
          type: def.maint,
          reason: 'Radio malfunction',
          startedById: users[5].id,
          startDate: new Date('2026-01-25'),
        },
      });
    }

    kits.push(kit);
  }
  console.log(`  Created ${kits.length} kits`);

  // ─── Set some critical components as DAMAGED/MISSING to demonstrate degraded status ───
  const uxvComp = comps.find(c => c.key === 'uxv');
  const silvusComp = comps.find(c => c.key === 'silvus4200');
  // ORANGE kit (index 2) - UXV is DAMAGED → degraded
  if (uxvComp) {
    await prisma.kitComponentStatus.updateMany({
      where: { kitId: kits[2].id, componentId: uxvComp.id },
      data: { status: 'DAMAGED' },
    });
  }
  // CHECKER kit (index 9) - Silvus 4200 is MISSING → degraded
  if (silvusComp) {
    await prisma.kitComponentStatus.updateMany({
      where: { kitId: kits[9].id, componentId: silvusComp.id },
      data: { status: 'MISSING' },
    });
  }
  console.log('  Set 2 kits as degraded (critical component issues)');

  // ─── Consumables ───
  const consumables = await Promise.all([
    prisma.consumable.create({ data: { name: 'AA Batteries', sku: 'BAT-AA', category: 'Power', qty: 48, minQty: 20, unit: 'ea' } }),
    prisma.consumable.create({ data: { name: 'CR123 Batteries', sku: 'BAT-CR123', category: 'Power', qty: 24, minQty: 10, unit: 'ea' } }),
    prisma.consumable.create({ data: { name: 'Ethernet Cable 6ft', sku: 'CBL-ETH-6', category: 'Cables', qty: 15, minQty: 5, unit: 'ea' } }),
    prisma.consumable.create({ data: { name: 'Ethernet Cable 25ft', sku: 'CBL-ETH-25', category: 'Cables', qty: 8, minQty: 3, unit: 'ea' } }),
    prisma.consumable.create({ data: { name: 'Zip Ties (100pk)', sku: 'MISC-ZIP', category: 'Other', qty: 5, minQty: 2, unit: 'pk' } }),
    prisma.consumable.create({ data: { name: 'Desiccant Packs', sku: 'MISC-DES', category: 'Other', qty: 30, minQty: 10, unit: 'ea' } }),
  ]);
  console.log(`  Created ${consumables.length} consumables`);

  // ─── Standalone Assets ───
  const assets = await Promise.all([
    prisma.standaloneAsset.create({ data: { name: 'PVS-14 Night Vision', serial: 'NV-2024-001', category: 'Optics', locId: locs[0].id } }),
    prisma.standaloneAsset.create({ data: { name: 'PVS-14 Night Vision', serial: 'NV-2024-002', category: 'Optics', locId: locs[0].id } }),
    prisma.standaloneAsset.create({ data: { name: 'PVS-14 Night Vision', serial: 'NV-2024-003', category: 'Optics', locId: locs[0].id } }),
    prisma.standaloneAsset.create({ data: { name: 'FLIR Thermal Monocular', serial: 'TH-2024-001', category: 'Optics', locId: locs[1].id } }),
    prisma.standaloneAsset.create({ data: { name: 'FLIR Thermal Monocular', serial: 'TH-2024-002', category: 'Optics', locId: locs[1].id } }),
    prisma.standaloneAsset.create({ data: { name: 'Handheld GPS', serial: 'GPS-001', category: 'Comms', locId: locs[2].id } }),
    prisma.standaloneAsset.create({ data: { name: 'Handheld GPS', serial: 'GPS-002', category: 'Comms', locId: locs[2].id } }),
    prisma.standaloneAsset.create({ data: { name: 'Satellite Phone', serial: 'SAT-001', category: 'Comms', locId: locs[0].id } }),
    prisma.standaloneAsset.create({ data: { name: 'Rangefinder', serial: 'RF-001', category: 'Optics', locId: locs[3].id } }),
    prisma.standaloneAsset.create({ data: { name: 'Rangefinder', serial: 'RF-002', category: 'Optics', locId: locs[3].id } }),
  ]);
  console.log(`  Created ${assets.length} standalone assets`);

  // ─── Reservations ───
  await Promise.all([
    prisma.reservation.create({ data: { kitId: kits[0].id, personId: users[4].id, startDate: new Date('2026-02-10'), endDate: new Date('2026-02-14'), purpose: 'Field exercise', status: 'confirmed' } }),
    prisma.reservation.create({ data: { kitId: kits[5].id, personId: users[2].id, startDate: new Date('2026-02-08'), endDate: new Date('2026-02-09'), purpose: 'Training demo', status: 'confirmed' } }),
    prisma.reservation.create({ data: { kitId: kits[2].id, personId: users[6].id, startDate: new Date('2026-02-15'), endDate: new Date('2026-02-20'), purpose: 'Mission support', status: 'pending' } }),
  ]);
  console.log('  Created 3 reservations');

  // ─── Audit Logs (historical) ───
  await Promise.all([
    prisma.auditLog.create({ data: { action: 'checkout', target: 'kit', targetId: kits[1].id, userId: users[1].id, date: new Date('2026-01-15T09:00:00Z'), details: { kitColor: 'RED' } } }),
    prisma.auditLog.create({ data: { action: 'checkout', target: 'kit', targetId: kits[3].id, userId: users[2].id, date: new Date('2026-01-10T08:30:00Z'), details: { kitColor: 'YELLOW' } } }),
    prisma.auditLog.create({ data: { action: 'checkout', target: 'kit', targetId: kits[4].id, userId: users[3].id, date: new Date('2026-01-10T08:45:00Z'), details: { kitColor: 'PURPLE' } } }),
    prisma.auditLog.create({ data: { action: 'checkout', target: 'kit', targetId: kits[7].id, userId: users[6].id, date: new Date('2026-01-20T10:00:00Z'), details: { kitColor: 'BLUE' } } }),
    prisma.auditLog.create({ data: { action: 'checkout', target: 'kit', targetId: kits[10].id, userId: users[7].id, date: new Date('2026-01-22T14:00:00Z'), details: { kitColor: 'RWB' } } }),
    prisma.auditLog.create({ data: { action: 'inspect', target: 'kit', targetId: kits[0].id, userId: users[0].id, date: new Date('2026-01-20T11:00:00Z'), details: { kitColor: 'PINK' } } }),
    prisma.auditLog.create({ data: { action: 'inspect', target: 'kit', targetId: kits[1].id, userId: users[5].id, date: new Date('2026-01-18T09:00:00Z'), details: { kitColor: 'RED' } } }),
    prisma.auditLog.create({ data: { action: 'return', target: 'kit', targetId: kits[2].id, userId: users[4].id, date: new Date('2026-01-12T16:00:00Z'), details: { kitColor: 'ORANGE' } } }),
    prisma.auditLog.create({ data: { action: 'maintenance_start', target: 'kit', targetId: kits[11].id, userId: users[5].id, date: new Date('2026-01-25T08:00:00Z'), details: { kitColor: 'GOLD', reason: 'Radio malfunction' } } }),
    prisma.auditLog.create({ data: { action: 'location_change', target: 'kit', targetId: kits[5].id, userId: users[2].id, date: new Date('2026-01-28T13:00:00Z'), details: { kitColor: 'GREEN', from: 'ATX BL7', to: 'GTX - Demo' } } }),
  ]);
  console.log('  Created 10 audit log entries');

  // ─── Default Settings ───
  const defaultSettings = {
    requireDeptApproval: true,
    allowUserLocationUpdate: true,
    requireSerialsOnCheckout: true,
    requireSerialsOnReturn: true,
    requireSerialsOnInspect: true,
    allowUserInspect: true,
    allowUserCheckout: true,
    inspectionDueThreshold: 30,
    overdueReturnThreshold: 14,
    enableReservations: true,
    enableMaintenance: true,
    enableConsumables: true,
    adminPerms: {
      analytics: true, reports: true, maintenance: true, consumables: true,
      types: true, components: true, locations: true, departments: true, personnel: true,
    },
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.systemSetting.create({ data: { key, value } });
  }
  console.log('  Created system settings');

  console.log('\nSeed complete!');
  console.log('\nDefault credentials:');
  console.log('  All users password: password');
  console.log('  Super Admin: Jordan Martinez');
  console.log('  Admin: Taylor Nguyen');
}

main()
  .catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
