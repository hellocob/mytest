var mongoose  = require('mongoose');
var BaseModel = require("./base_model");
var Schema    = mongoose.Schema;
var ObjectId  = Schema.ObjectId;
var config    = require('../config');
var _         = require('lodash');

var TopicSchema = new Schema({
  title: { type: String },
  content: { type: String },
  author_id: { type: ObjectId },//创建者id
  parent_id: { type: ObjectId },//扩展父话题id--cob 2017-4-12
  top: { type: Boolean, default: false }, // 置顶帖
  good: {type: Boolean, default: false}, // 精华帖
  lock: {type: Boolean, default: false}, // 被锁定主题
  reply_count: { type: Number, default: 0 },//回复计数
  visit_count: { type: Number, default: 0 },//访问计数
  collect_count: { type: Number, default: 0 },//收藏计数
  create_at: { type: Date, default: Date.now },
  update_at: { type: Date, default: Date.now },
  last_reply: { type: ObjectId },
  last_reply_at: { type: Date, default: Date.now },
  content_is_html: { type: Boolean },
  teams: [Schema.Types.ObjectId],//扩展本话题管理团队列表--cob 2017-4-15
  target:[Schema.Types.ObjectId],//允许在本话题下新开话题时使用的标签-cob 2017-4-15
  tab: {type: String},//记录话题生成时用户选择的分类标签
  deleted: {type: Boolean, default: false},
});

TopicSchema.plugin(BaseModel);
TopicSchema.index({create_at: -1});
TopicSchema.index({top: -1, last_reply_at: -1});
TopicSchema.index({author_id: 1, create_at: -1});

TopicSchema.virtual('tabName').get(function () {
  var tab  = this.tab;
  var pair = _.find(config.tabs, function (_pair) {
    return _pair[0] === tab;
  });

  if (pair) {
    return pair[1];
  } else {
    return '';
  }
});

mongoose.model('Topic', TopicSchema);
