import hello from '<%= packageName %>';

QUnit.module('<%= packageName %> tests');

QUnit.test('hello', assert => {
  assert.equal(hello(), 'Hello from <%= packageName %>');
});
