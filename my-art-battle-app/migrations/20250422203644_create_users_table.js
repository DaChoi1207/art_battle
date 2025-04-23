/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('username', 100);
    table.string('email', 255);
    table.string('auth_provider', 50);
    table.integer('games_played').defaultTo(0);
    table.integer('games_won').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.text('profile_pic');
    table.unique(['email']);
  });
};

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('users');
};