# Central Hardwares Management System

A web-based hardware shop management system developed as a university group project.

## Overview

The system is designed to support day-to-day hardware store operations through a central management dashboard.

## Main modules

- Inventory management
- Customer management
- Supplier management
- Order management
- Invoicing
- Financial management
- User management and authentication
- Services and delivery
- Reports, notifications and activity logs

## Technology stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** PHP
- **Database:** MySQL
- **Dependency management:** Composer
- **Local development:** WAMP Server

## My contribution

**User Management**

My main contribution to this group project was the User Management module. This repository contains the wider team project; the work should be understood as a collaborative university project, not an individual end-to-end implementation.

## Getting started

1. Install WAMP Server with PHP and MySQL enabled.
2. Clone or download this repository into your WAMP `www` directory.
3. Review `backend php/config.php` and configure the local database connection for your environment.
4. Open phpMyAdmin and import `database/database.sql` into MySQL.
5. From the project root, install PHP dependencies with:

   ```bash
   composer install
   ```

6. Start Apache and MySQL in WAMP.
7. Open the project through your local server, for example:

   `http://localhost/Final%20PPA%20System/`

   Adjust the URL to match the folder name you use in `www`.

## Configuration and security

- Do not commit real passwords, API keys, SMTP credentials, database dumps containing personal information, or production configuration.
- The bundled SQL file has had its preconfigured demo user accounts removed. Create a fresh account through the application's signup flow.
- The PHP configuration currently contains local WAMP defaults. Change these for your own machine and keep real credentials out of Git.
- Stripe/payment settings should use test credentials stored locally, never live keys in source control.
- This repository is private while team permission and project publication arrangements are being handled.

## Project structure

- `backend php/` – PHP backend endpoints and database configuration
- `pages/` – application pages
- `components/` – shared UI components
- `css/` – stylesheets
- `js/` – frontend scripts
- `database/` – MySQL schema and sample data
- `docs/` – project documentation
- `images/` – application assets

## Project status

University group project. This repository is being organized for portfolio and learning purposes.

## Acknowledgements

Developed collaboratively as part of a university group project. Team member names and individual contributions should be added here with their agreement.
