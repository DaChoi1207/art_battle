/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('players', function(table) {
      table.increments('id').primary();
      table.string('username').notNullable();
      table.string('profile_picture');
      table.integer('games_played').defaultTo(0);
      table.integer('games_won').defaultTo(0);
      table.timestamps(true, true); // created_at and updated_at
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = function(knex) {
    return knex.schema.dropTable('players');
  };