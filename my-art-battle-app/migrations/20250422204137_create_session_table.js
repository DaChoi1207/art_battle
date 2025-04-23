/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('session', function(table) {
    table.string('sid').primary();
    table.json('sess').notNullable();
    table.timestamp('expire', { useTz: false }).notNullable();
  }).then(function() {
    return knex.raw('CREATE INDEX "IDX_session_expire" ON "session" ("expire")');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('session');
};
