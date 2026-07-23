import 'dotenv/config';
import mongoose from 'mongoose';
import connectMongoDB from '../database/mongodb.js';
import User from '../models/user.model.js';
import Entity from '../models/entity.model.js';
import SOSCase from '../models/sos-case.model.js';
import AuditLog from '../models/audit-log.model.js';
import SupportTicket from '../models/support-ticket.model.js';

export const seedData = async (shouldExit = false) => {
  try {
    await connectMongoDB();
    console.log('Connected to MongoDB for seeding...');

    // Clear existing collections
    await User.deleteMany({}).exec();
    await Entity.deleteMany({}).exec();
    await SOSCase.deleteMany({}).exec();
    await AuditLog.deleteMany({}).exec();
    await SupportTicket.deleteMany({}).exec();
    console.log('Cleared existing data.');

    // Seed physical Entities
    const entities = [
      {
        name: 'RapidAid City General Hospital',
        type: 'hospital',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        address: '12 MG Road, Bangalore Central',
        contactNumber: '+919876543210',
        hospitalResources: {
          roomsTotal: 40, roomsOccupied: 15,
          bedsGeneralTotal: 100, bedsGeneralOccupied: 45,
          bedsIcuTotal: 20, bedsIcuOccupied: 8,
          bloodBank: [
            { bloodGroup: 'A+', units: 25 }, { bloodGroup: 'A-', units: 10 },
            { bloodGroup: 'B+', units: 30 }, { bloodGroup: 'B-', units: 8 },
            { bloodGroup: 'AB+', units: 15 }, { bloodGroup: 'AB-', units: 5 },
            { bloodGroup: 'O+', units: 45 }, { bloodGroup: 'O-', units: 20 }
          ],
          ambulances: [
            { ambulanceId: 'AMB01', plateNumber: 'KA-01-ME-1234', status: 'available', location: { lat: 12.972, lng: 77.595 } },
            { ambulanceId: 'AMB02', plateNumber: 'KA-01-ME-5678', status: 'dispatched', location: { lat: 12.970, lng: 77.593 } },
            { ambulanceId: 'AMB03', plateNumber: 'KA-01-ME-9012', status: 'available', location: { lat: 12.973, lng: 77.596 } }
          ],
          doctors: [
            { name: 'Dr. Ramesh Kumar', department: 'Emergency Medicine', available: true },
            { name: 'Dr. Sarah Mathews', department: 'Cardiology', available: true },
            { name: 'Dr. Anil Mehta', department: 'Trauma Surgery', available: false },
            { name: 'Dr. Priya Rao', department: 'Neurology', available: true }
          ]
        }
      },
      {
        name: 'Central City Police Station',
        type: 'police',
        location: { type: 'Point', coordinates: [77.5925, 12.9735] },
        address: '5 Cubbon Road, Bangalore',
        contactNumber: '+918888888888'
      },
      {
        name: 'City Fire and Emergency Rescue Station',
        type: 'rescue',
        location: { type: 'Point', coordinates: [77.5975, 12.9695] },
        address: '18 Queens Road, Bangalore',
        contactNumber: '+917777777777'
      }
    ];

    const seededEntities = await Entity.insertMany(entities);
    console.log('Seeded Physical Entities:', seededEntities.length);

    const hospital = seededEntities.find(e => e.type === 'hospital');
    const police = seededEntities.find(e => e.type === 'police');
    const rescue = seededEntities.find(e => e.type === 'rescue');

    const users = [
      { name: 'System Admin Account', email: 'admin@rapidaid.com', password: 'adminpassword', role: 'system_admin', phone: '+919999999999', status: 'active' },
      { name: 'Regular Citizen User', email: 'user@rapidaid.com', password: 'userpassword', role: 'user', phone: '+918080808080', status: 'active', emergencyContacts: [{ name: 'Contact Parent', phone: '+919000000001', relation: 'Parent' }] },
      { name: 'Hospital Admin Manager', email: 'hospital@rapidaid.com', password: 'hospitalpassword', role: 'hospital_admin', phone: '+919090909090', status: 'active', entityId: hospital._id },
      { name: 'Police Patrol Officer', email: 'police@rapidaid.com', password: 'policepassword', role: 'police', phone: '+918282828282', status: 'active', entityId: police._id },
      { name: 'Rescue Chief Officer', email: 'rescue@rapidaid.com', password: 'rescuepassword', role: 'rescue_person', phone: '+917474747474', status: 'active', entityId: rescue._id }
    ];

    for (const u of users) await User.create(u);
    console.log('Seeded Users successfully.');

    const sysAdminUser = await User.findOne({ email: 'admin@rapidaid.com' }).exec();
    await AuditLog.create({ action: 'SYSTEM_INITIALIZATION', performedBy: sysAdminUser._id, details: 'RapidAid System Initialized with default seeder stations and operational admin users.' });

    console.log('Database seeding finished successfully!');
    if (shouldExit) process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    if (shouldExit) process.exit(1);
    throw error;
  }
};

import { fileURLToPath } from 'url';
const isMain = process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('seed.js'));
if (isMain) seedData(true);
