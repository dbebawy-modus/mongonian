const Joi = require('joi');
const { validator } = require('../../../perigress');
module.exports = Joi.object().keys({
    id: Joi.number().integer().required(),
    transaction_id: Joi.number().integer().required(),
    avatar_user_id: Joi.number().integer().required(),
    creator_user_id: Joi.number().integer().required()
});
