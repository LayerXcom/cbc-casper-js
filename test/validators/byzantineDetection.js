var hashObj = require('object-hash');
var assert = require("assert");
var BinaryValidator = require("../../validators/binary")
var MsgDB = require("../../db");


describe('Validator Byzantine detection', function() {
	
	it('should flag a sender as Byzantine if they fail to provide ' + 
	'one of thier own messages in their justification.', function() {
		let db = new MsgDB();
		let v = new BinaryValidator('Test', 0, 0, db);

		const msg1 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [],
		});
		const msg2 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [
				{
					sender: 'Zebra',
					estimate: 0,		
					justification: [],
				},
				{
					sender: 'Sally',
					estimate: 0,
					justification: [],
				}
			],
		});

		v.parseMsg(msg1);

		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the sent message should be the latest messsage.'
		);

		v.parseMsg(msg2);

		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the message was invalid and should not become the latest message.'
		);

		assert(v.isByzantine['Brian'], 'Brian should be Byzantine')
	});
	
	it('should flag a sender as Byzantine if they present a contradicting initial message', function() {
		let db = new MsgDB();
		let v = new BinaryValidator('Test', 0, 0, db);

		const msg1 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [],
		});
		const msg2 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [
				{
					sender: 'Brian',
					estimate: 1,		// <-- contradicts Brian's previous msg
					justification: [],
				},
				{
					sender: 'Sally',
					estimate: 0,
					justification: [],
				}
			],
		});
		// parse the first message
		v.parseMsg(msg1);
		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the sent message should be the latest messsage.'
		);
		// parse the second message
		v.parseMsg(msg2);
		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the message was invalid and should not become the latest message.'
		);
		// Brian should be flagged as Byzantine
		assert(v.isByzantine['Brian'], 'Brian should be Byzantine')
	});
	
	it('should flag a sender as Byzantine if they send a message ' +
		'which has multiple messages from the same sender in the ' +
		'justification.', function() {
		let db = new MsgDB();
		let v = new BinaryValidator('Test', 0, 0, db);
			
		const msg1 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [],
		});
		const msg2 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [
				{
					sender: 'Brian',
					estimate: 0,
					justification: [],
				},
				{
					sender: 'Sally',
					estimate: 0,
					justification: [],
				},
				{
					sender: 'Brian', // <-- Brian is double voting here
					estimate: 0,
					justification: [],
				},
			],
		});
		// parse the first message
		v.parseMsg(msg1);
		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the sent message should be the latest messsage.'
		);
		// parse the second message
		v.parseMsg(msg2);
		// Brian should be flagged as Byzantine
		assert(v.isByzantine['Brian'], 'Brian should be Byzantine')
		// the message should have been ignored
		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the message was invalid and should not have become ' + 
			'the latest messsage.'
		);
	});
	
	it('should flag a sender as Byzantine if they send a message ' +
		'which has multiple messages from the same sender in the ' +
		'justification (when deep in messages).', function() {
		let db = new MsgDB();
		let v = new BinaryValidator('Test', 0, 0, db);

		const msg1 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [],
		});
		const msg2 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [
				{
					sender: 'Brian',
					estimate: 0,
					justification: [],
				},
				{
					sender: 'Sally',
					estimate: 0,
					justification: [
						{
							sender: 'Andy',
							estimate: 0,
							justification: [],
						},
						{
							sender: 'Andy', // <-- duplicate
							estimate: 0,
							justification: [],
						},
					],
				},
			],
		});
		// parse the first message
		v.parseMsg(msg1);
		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the sent message should be the latest messsage.'
		);
		// parse the second message
		v.parseMsg(msg2);
		// Brian should be flagged as Byzantine
		assert(v.isByzantine['Sally'], 'Sally should be Byzantine')
		// Brian's message should have been ignored
		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the message was invalid and should not have become ' + 
			'the latest messsage.'
		);
		// Sallys's message should have been ignored
		assert.equal(
			v.getLatestMsgHash('Sally'),
			undefined, 
			'Sallys message was Byzantine and should not have been stored '		
		);
	});
	
	it('should flag a sender as Byzantine if they fork their history', function() {
		let db = new MsgDB();
		let v = new BinaryValidator('Test', 0, 0, db);

		const msg1 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [
				{
					sender: 'Fred',
					estimate: 0,
					justification: [],
				},
				{
					sender: 'Brian',
					estimate: 0,
					justification: [
						{
							sender: 'Eddy',
							estimate: 0,
							justification: [],
						},
						{
							sender: 'Brian',
							estimate: 0,
							justification: [
								{
									sender: 'Donna',
									estimate: 0,
									justification: [],
								},
								{
									sender: 'Brian',
									estimate: 0,
									justification: [
										{
											sender: 'Brian',
											estimate: 0,
											justification: [],
										},
										{
											sender: 'Sally',
											estimate: 0,
											justification: [],
										}
									]
								},
							]
						},
					]
				}
			]
		});
		const msg2 = db.store({
			sender: 'Brian',
			estimate: 0,
			justification: [
				{
					sender: 'Fred',
					estimate: 0,
					justification: [],
				},
				{
					sender: 'Brian',
					estimate: 0,
					justification: [
						{
							sender: 'Xena', // <--- This is an equivocation
							estimate: 0,
							justification: [],
						},
						{
							sender: 'Brian',
							estimate: 0,
							justification: [
								{
									sender: 'Donna',
									estimate: 0,
									justification: [],
								},
								{
									sender: 'Brian',
									estimate: 0,
									justification: [
										{
											sender: 'Brian',
											estimate: 0,
											justification: [],
										},
										{
											sender: 'Sally',
											estimate: 0,
											justification: [],
										}
									]
								},
							]
						},
					]
				}
			]
		});
		// parse the first message
		v.parseMsg(msg1);
		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the sent message should be the latest messsage.'
		);
		// parse the second message
		const err = v.parseMsg(msg2);
		assert.equal(
			v.getLatestMsgHash('Brian'),
			msg1, 
			'the message was invalid and should not become the latest message.'
		);
		// Brian should be flagged as Byzantine
		assert(v.isByzantine['Brian'], 'Brian should be Byzantine')
	});
	
	it('should flag as Byzantine if there is a fork in the history ' + 
		'of another sender.', function() {
		let db = new MsgDB();
		let v = new BinaryValidator('Test', 0, 0, db);

		const msg1 = db.store({
			sender: 'Graham',
			estimate: 0,
			justification: [
				{
					sender: 'Graham',
					estimate: 0,
					justification: []
				},
				{
					sender: 'Brian',
					estimate: 0,
					justification: [
						{
							sender: 'Fred',
							estimate: 0,
							justification: [],
						},
						{
							sender: 'Brian',
							estimate: 0,
							justification: [
								{
									sender: 'Eddy',
									estimate: 0,
									justification: [],
								},
								{
									sender: 'Brian',
									estimate: 0,
									justification: [
										{
											sender: 'Donna',
											estimate: 0,
											justification: [],
										},
										{
											sender: 'Brian',
											estimate: 0,
											justification: [
												{
													sender: 'Brian',
													estimate: 0,
													justification: [],
												},
												{
													sender: 'Sally',
													estimate: 0,
													justification: [],
												}
											]
										},
									]
								},
							]
						}
					]
				}
			]
		});
		const msg2 = db.store({
			sender: 'Graham',
			estimate: 0,
			justification: [
				msg1,
				{
					sender: 'Brian',
					estimate: 0,
					justification: [
						{
							sender: 'Fred',
							estimate: 0,
							justification: [],
						},
						{
							sender: 'Brian',
							estimate: 0,
							justification: [
								{
									sender: 'Zebra', // <--- This is an equivocation
									estimate: 0,
									justification: [],
								},
								{
									sender: 'Brian',
									estimate: 0,
									justification: [
										{
											sender: 'Donna',
											estimate: 0,
											justification: [],
										},
										{
											sender: 'Brian',
											estimate: 0,
											justification: [
												{
													sender: 'Brian',
													estimate: 0,
													justification: [],
												},
												{
													sender: 'Sally',
													estimate: 0,
													justification: [],
												}
											]
										},
									]
								},
							]
						}
					]
				}
			]
		});
		// parse the first message
		v.parseMsg(msg1);
		assert.equal(
			v.getLatestMsgHash('Graham'),
			msg1, 
			'the sent message should be the latest messsage.'
		);
		// parse the second message
		v.parseMsg(msg2);
		assert.equal(
			v.getLatestMsgHash('Graham'),
			msg1, 
			'the message was invalid and should not become the latest message.'
		);
		// Brian should be flagged as Byzantine
		assert(v.isByzantine['Brian'], 'Brian should be Byzantine')
	});
	
	it('should flag a sender as Byzantine if they provide an incorrect estimation.', function() {
		let db = new MsgDB();
		let v = new BinaryValidator('Test', 0, 0, db);

		const msg = db.store({
			sender: 'Brian',
			estimate: 1,
			justification: [
				{
					sender: 'Zebra',
					estimate: 0,		
					justification: [],
				},
				{
					sender: 'Sally',
					estimate: 0,
					justification: [],
				},
				{
					sender: 'Brian',
					estimate: 1,
					justification: [],
				}
			],
		});
		// parse the first message
		v.parseMsg(msg);
		// Brian should be flagged as Byzantine
		assert(v.isByzantine['Brian'], 'Brian should be Byzantine')
	});

});
